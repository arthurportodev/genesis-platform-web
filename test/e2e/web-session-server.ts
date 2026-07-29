import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const host = "127.0.0.1";
const port = 4173;
const dist = path.resolve(process.cwd(), "dist");

interface Session {
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  familyId: string;
}

const sessionsByRefresh = new Map<string, Session>();
const sessionsByAccess = new Map<string, Session>();
const retiredRefreshFamilies = new Map<string, string>();
let refreshCount = 0;
let sequence = 0;
let leadRevision = 3;
let leadStage = "qualification";
let conflictNextLeadMutation = false;
let pipelineContinuationFails = false;
let pipelineConflictStatus: 409 | 412 | null = null;
let pipelineUncertainOnce = false;
const completedPipelineMoves = new Set<string>();
let workLeadRevision = 3;
let workLeadCompleted = false;
const completedWorkActions = new Set<string>();
let metricsStatus: 400 | 401 | 403 | 429 | 500 | 503 | null = null;
let metricsMode: "default" | "zeros" | "future-source" = "default";
let metricsRequests = 0;
let metricsDelayMs = 0;
let createMode: "new" | "existing" | "uncertain" | "conflict" = "new";
let createDelayMs = 0;
const completedLeadCreates = new Set<string>();
const createRequestKeys: string[] = [];
let createHadIfMatch = false;

const leadId = "00000000-0000-4000-8000-000000000010";
const secondLeadId = "00000000-0000-4000-8000-000000000020";
const workLeadId = "00000000-0000-4000-8000-000000000040";
const workActionId = "00000000-0000-4000-8000-000000000041";
const cycleId = "00000000-0000-4000-8000-000000000012";
const entryId = "00000000-0000-4000-8000-000000000013";

function parseCookies(request: IncomingMessage): Map<string, string> {
  const result = new Map<string, string>();
  for (const segment of (request.headers.cookie ?? "").split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    result.set(
      segment.slice(0, separator).trim(),
      decodeURIComponent(segment.slice(separator + 1).trim()),
    );
  }
  return result;
}

function json(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function authError(response: ServerResponse, status: number, message: string) {
  json(response, status, {
    statusCode: status,
    message,
    error: status === 401 ? "Unauthorized" : "Bad Request",
  });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const value: unknown = chunk;
    if (typeof value === "string") chunks.push(Buffer.from(value));
    else if (value instanceof Uint8Array) chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function issueSession(email: string, familyId: string = randomUUID()): Session {
  sequence += 1;
  const session = {
    userEmail: email,
    accessToken: `access-${sequence}-${randomUUID()}`,
    refreshToken: `refresh-${sequence}-${randomUUID()}`,
    familyId,
  };
  sessionsByRefresh.set(session.refreshToken, session);
  sessionsByAccess.set(session.accessToken, session);
  return session;
}

function rotateSession(previous: Session): Session {
  sessionsByRefresh.delete(previous.refreshToken);
  sessionsByAccess.delete(previous.accessToken);
  retiredRefreshFamilies.set(previous.refreshToken, previous.familyId);
  return issueSession(previous.userEmail, previous.familyId);
}

function revokeFamily(familyId: string): void {
  for (const [token, session] of sessionsByRefresh) {
    if (session.familyId === familyId) sessionsByRefresh.delete(token);
  }
  for (const [token, session] of sessionsByAccess) {
    if (session.familyId === familyId) sessionsByAccess.delete(token);
  }
}

function publicUser(email: string) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: email.startsWith("multi") ? "Pessoa Multi" : "Pessoa Teste",
    email,
    status: "active",
  };
}

function organizations(email: string) {
  if (email.startsWith("zero")) return [];
  const first = {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Genesis Teste",
    slug: "genesis-teste",
    membershipId: "00000000-0000-4000-8000-000000000003",
    role: email.startsWith("admin") ? "admin" : "owner",
  };
  const second = {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Segunda Organização",
    slug: "segunda-organizacao",
    membershipId: "00000000-0000-4000-8000-000000000005",
    role: "member",
  };
  if (email.startsWith("member")) return [second];
  if (!email.startsWith("multi")) return [first];
  return [first, second];
}

function tokenResponse(session: Session) {
  return {
    accessToken: session.accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: publicUser(session.userEmail),
  };
}

function csrfValid(request: IncomingMessage): boolean {
  const cookie = parseCookies(request).get("genesis_csrf_dev");
  const header = request.headers["x-csrf-token"];
  return (
    typeof cookie === "string" &&
    typeof header === "string" &&
    cookie === header &&
    /^[A-Za-z0-9_-]{43}$/u.test(cookie)
  );
}

function setSessionCookie(session: Session): string {
  return `genesis_refresh_dev=${encodeURIComponent(session.refreshToken)}; HttpOnly; SameSite=Lax; Path=/`;
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (pathname === "/api/v1/auth/csrf" && request.method === "GET") {
    const csrfToken = randomBytes(32).toString("base64url");
    json(
      response,
      200,
      { csrfToken },
      {
        "Set-Cookie": `genesis_csrf_dev=${csrfToken}; SameSite=Lax; Path=/`,
      },
    );
    return;
  }
  if (
    [
      "/api/v1/auth/login",
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
      "/api/v1/auth/logout-all",
    ].includes(pathname) &&
    !csrfValid(request)
  ) {
    authError(response, 403, "CSRF validation failed.");
    return;
  }
  if (pathname === "/api/v1/auth/login" && request.method === "POST") {
    const body = (await readJson(request)) as {
      email?: string;
      password?: string;
    };
    if (!body.email?.endsWith(".test") || body.password !== "correct-horse") {
      authError(response, 401, "Invalid email or password.");
      return;
    }
    const session = issueSession(body.email);
    json(response, 200, tokenResponse(session), {
      "Set-Cookie": setSessionCookie(session),
    });
    return;
  }
  if (pathname === "/api/v1/auth/refresh" && request.method === "POST") {
    const refreshToken = parseCookies(request).get("genesis_refresh_dev");
    const existing = refreshToken
      ? sessionsByRefresh.get(refreshToken)
      : undefined;
    if (!existing) {
      const reusedFamily = refreshToken
        ? retiredRefreshFamilies.get(refreshToken)
        : undefined;
      if (reusedFamily) revokeFamily(reusedFamily);
      authError(response, 401, "Invalid refresh token.");
      return;
    }
    refreshCount += 1;
    const session = rotateSession(existing);
    json(response, 200, tokenResponse(session), {
      "Set-Cookie": setSessionCookie(session),
    });
    return;
  }
  if (pathname === "/api/v1/auth/bootstrap" && request.method === "GET") {
    const authorization = request.headers.authorization;
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    const session = accessToken ? sessionsByAccess.get(accessToken) : undefined;
    if (!session) {
      authError(response, 401, "Unauthorized");
      return;
    }
    json(response, 200, {
      user: publicUser(session.userEmail),
      organizations: organizations(session.userEmail),
    });
    return;
  }
  if (pathname === "/api/v1/auth/logout" && request.method === "POST") {
    const refreshToken = parseCookies(request).get("genesis_refresh_dev");
    if (refreshToken) {
      const session = sessionsByRefresh.get(refreshToken);
      if (session) sessionsByAccess.delete(session.accessToken);
      sessionsByRefresh.delete(refreshToken);
    }
    response.writeHead(204, {
      "Cache-Control": "no-store",
      "Set-Cookie": [
        "genesis_refresh_dev=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
        "genesis_csrf_dev=; Max-Age=0; SameSite=Lax; Path=/",
      ],
    });
    response.end();
    return;
  }
  if (pathname === "/api/v1/auth/logout-all" && request.method === "POST") {
    const authorization = request.headers.authorization;
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;
    const session = accessToken ? sessionsByAccess.get(accessToken) : undefined;
    if (!session) {
      authError(response, 401, "Unauthorized");
      return;
    }
    for (const [token, candidate] of sessionsByRefresh) {
      if (candidate.userEmail === session.userEmail)
        sessionsByRefresh.delete(token);
    }
    for (const [token, candidate] of sessionsByAccess) {
      if (candidate.userEmail === session.userEmail)
        sessionsByAccess.delete(token);
    }
    response.writeHead(204, {
      "Cache-Control": "no-store",
      "Set-Cookie": [
        "genesis_refresh_dev=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
        "genesis_csrf_dev=; Max-Age=0; SameSite=Lax; Path=/",
      ],
    });
    response.end();
    return;
  }
  const tenant = tenantRequest(request);
  if (pathname.startsWith("/api/v1/leads") || pathname === "/api/v1/members") {
    if (!tenant.session) {
      authError(response, 401, "Unauthorized");
      return;
    }
    if (!tenant.organizationId) {
      authError(response, 403, "Organization required.");
      return;
    }
  }
  if (pathname === "/api/v1/leads" && request.method === "GET") {
    const secondOrganization =
      tenant.organizationId === "00000000-0000-4000-8000-000000000004";
    const q = requestUrl.searchParams.get("q")?.toLocaleLowerCase("pt-BR");
    const lead = leadDetail(
      secondOrganization ? secondLeadId : leadId,
      secondOrganization ? "Lead Segunda" : "Lead Exemplo",
    );
    const visible =
      !q || lead.displayName.toLocaleLowerCase("pt-BR").includes(q);
    json(response, 200, {
      items: visible ? [leadListItem(lead)] : [],
      page: {
        nextCursor: null,
        limit: Number(requestUrl.searchParams.get("limit") ?? 25),
        total: visible ? 1 : 0,
        asOf: "2026-07-28T16:00:00.000Z",
      },
    });
    return;
  }
  if (pathname === "/api/v1/leads" && request.method === "POST") {
    const key = request.headers["idempotency-key"];
    createHadIfMatch ||= typeof request.headers["if-match"] === "string";
    if (
      typeof key !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        key,
      ) ||
      createHadIfMatch
    ) {
      authError(response, 400, "Invalid create headers.");
      return;
    }
    createRequestKeys.push(key);
    await readJson(request);
    if (createDelayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, createDelayMs));
    if (createMode === "conflict") {
      authError(response, 409, "Create conflict.");
      return;
    }
    const member =
      tenant.session?.userEmail.startsWith("member") === true ||
      tenant.organizationId === "00000000-0000-4000-8000-000000000004";
    if (member) {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    const replayed = completedLeadCreates.has(key);
    completedLeadCreates.add(key);
    if (createMode === "uncertain" && !replayed) {
      json(
        response,
        200,
        { outcome: "not-confirmed" },
        {
          ETag: `"lead:${leadId}:${leadRevision}"`,
        },
      );
      return;
    }
    const status = createMode === "new" && !replayed ? 201 : 200;
    const created = leadView(leadId, "Lead Exemplo");
    json(response, status, created, {
      ETag: `"lead:${leadId}:${leadRevision}"`,
      ...(status === 201 ? { Location: `/api/v1/leads/${leadId}` } : {}),
      ...(replayed ? { "Idempotency-Replayed": "true" } : {}),
    });
    return;
  }
  if (pathname === "/api/v1/leads/kanban" && request.method === "GET") {
    const stage = requestUrl.searchParams.get("stage");
    const cursor = requestUrl.searchParams.get("cursor");
    if (stage && cursor && pipelineContinuationFails) {
      authError(response, 503, "Pipeline continuation unavailable.");
      return;
    }
    const secondOrganization =
      tenant.organizationId === "00000000-0000-4000-8000-000000000004";
    const currentLead = leadDetail(
      secondOrganization ? secondLeadId : leadId,
      secondOrganization ? "Lead Segunda" : "Lead Exemplo",
    );
    const q = requestUrl.searchParams.get("q")?.toLocaleLowerCase("pt-BR");
    const visible =
      !q || currentLead.displayName.toLocaleLowerCase("pt-BR").includes(q);
    const stages = stage
      ? [stage]
      : ["new", "qualification", "diagnosis", "proposal", "negotiation"];
    json(response, 200, {
      asOf: new Date().toISOString(),
      columns: stages.map((candidate) => ({
        stage: candidate,
        total: visible && candidate === leadStage ? 2 : 0,
        items:
          visible && candidate === leadStage
            ? cursor
              ? [
                  leadListItem({
                    ...currentLead,
                    id: "00000000-0000-4000-8000-000000000030",
                    displayName: "Lead Continuação",
                  }),
                ]
              : [leadListItem(currentLead)]
            : [],
        page: {
          limit: 20,
          nextCursor:
            visible && candidate === leadStage && !cursor
              ? "opaque-kanban-cursor"
              : null,
        },
      })),
    });
    return;
  }
  if (
    pathname === "/api/v1/leads/metrics/summary" &&
    request.method === "GET"
  ) {
    metricsRequests += 1;
    if (metricsDelayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, metricsDelayMs));
    const member =
      tenant.session?.userEmail.startsWith("member") === true ||
      tenant.organizationId === "00000000-0000-4000-8000-000000000004";
    if (member || metricsStatus === 403) {
      authError(response, 403, "Forbidden");
      return;
    }
    if (metricsStatus) {
      authError(response, metricsStatus, "Metrics unavailable.");
      return;
    }
    const from = requestUrl.searchParams.get("from") ?? "2026-06-30";
    const to = requestUrl.searchParams.get("to") ?? "2026-07-29";
    const zero = metricsMode === "zeros";
    const future = metricsMode === "future-source";
    json(response, 200, {
      asOf: "2026-07-29T16:40:00.000Z",
      timeZone: "America/Belem",
      snapshot: {
        active: zero ? 0 : 42,
        unassigned: zero ? 0 : 7,
        overdue: zero ? 0 : 5,
        withoutNextAction: zero ? 0 : 9,
        pendingReturns: zero ? 0 : 2,
      },
      period: {
        from,
        to,
        created: zero ? 0 : future ? 2 : 30,
        won: zero ? 0 : 12,
        lost: zero ? 0 : 8,
        createdBySource: zero
          ? []
          : future
            ? [{ source: "partner_referral", count: 2 }]
            : [
                { source: "campaign", count: 12 },
                { source: "landing_page", count: 10 },
                { source: "manual", count: 8 },
              ],
      },
    });
    return;
  }
  if (
    pathname === "/api/v1/leads/work/my-actions" &&
    request.method === "GET"
  ) {
    const lead = workLeadDetail();
    json(response, 200, {
      items: workLeadCompleted ? [] : [workLeadListItem(lead)],
      page: {
        nextCursor: null,
        limit: Number(requestUrl.searchParams.get("limit") ?? 25),
        total: workLeadCompleted ? 0 : 1,
        asOf: new Date().toISOString(),
      },
    });
    return;
  }
  if (
    (pathname === "/api/v1/leads/work/unassigned" ||
      pathname === "/api/v1/leads/work/return-reviews") &&
    request.method === "GET"
  ) {
    json(response, 200, {
      items: [],
      page: {
        nextCursor: null,
        limit: Number(requestUrl.searchParams.get("limit") ?? 25),
        total: 0,
        asOf: new Date().toISOString(),
      },
    });
    return;
  }
  if (pathname === "/api/v1/members" && request.method === "GET") {
    json(response, 200, {
      items: [
        {
          id: "00000000-0000-4000-8000-000000000011",
          name: "Pessoa Responsável",
          email: "responsavel@example.test",
          role: "member",
          status: "active",
          createdAt: "2026-07-20T12:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
        },
      ],
      page: { nextCursor: null, limit: 100 },
    });
    return;
  }
  const detailMatch = /^\/api\/v1\/leads\/([0-9a-f-]{36})$/iu.exec(pathname);
  if (detailMatch && request.method === "GET") {
    if (detailMatch[1] === workLeadId) {
      const lead = workLeadDetail();
      json(response, 200, lead, {
        ETag: `"lead:${lead.id}:${lead.revision}"`,
      });
      return;
    }
    const name =
      detailMatch[1] === secondLeadId ? "Lead Segunda" : "Lead Exemplo";
    const lead = leadDetail(detailMatch[1], name);
    json(response, 200, lead, { ETag: `"lead:${lead.id}:${lead.revision}"` });
    return;
  }
  if (
    pathname === `/api/v1/leads/${workLeadId}/next-action/complete` &&
    request.method === "POST"
  ) {
    const key = request.headers["idempotency-key"];
    if (
      typeof key !== "string" ||
      request.headers["if-match"] !== `"lead:${workLeadId}:${workLeadRevision}"`
    ) {
      authError(response, 428, "If-Match and Idempotency-Key are required.");
      return;
    }
    await readJson(request);
    const replayed = completedWorkActions.has(key);
    if (!replayed) {
      completedWorkActions.add(key);
      workLeadCompleted = true;
      workLeadRevision += 1;
    }
    response.writeHead(204, {
      "Cache-Control": "no-store",
      ETag: `"lead:${workLeadId}:${workLeadRevision}"`,
      ...(replayed ? { "Idempotency-Replayed": "true" } : {}),
    });
    response.end();
    return;
  }
  if (
    pathname === `/api/v1/leads/${leadId}/move` &&
    request.method === "POST"
  ) {
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !request.headers["if-match"]) {
      authError(response, 428, "If-Match and Idempotency-Key are required.");
      return;
    }
    if (completedPipelineMoves.has(key)) {
      response.writeHead(204, {
        "Cache-Control": "no-store",
        ETag: `"lead:${leadId}:${leadRevision}"`,
        "Idempotency-Replayed": "true",
      });
      response.end();
      return;
    }
    if (!validLeadMutationHeaders(request)) {
      authError(response, 412, "Lead revision conflict.");
      return;
    }
    if (pipelineConflictStatus) {
      const status = pipelineConflictStatus;
      pipelineConflictStatus = null;
      authError(response, status, "Lead revision conflict.");
      return;
    }
    const body = (await readJson(request)) as { stage?: string };
    if (body.stage) leadStage = body.stage;
    leadRevision += 1;
    completedPipelineMoves.add(key);
    if (pipelineUncertainOnce) {
      pipelineUncertainOnce = false;
      response.destroy();
      return;
    }
    response.writeHead(204, {
      "Cache-Control": "no-store",
      ETag: `"lead:${leadId}:${leadRevision}"`,
    });
    response.end();
    return;
  }
  if (
    pathname === `/api/v1/leads/${leadId}/timeline` &&
    request.method === "GET"
  ) {
    json(response, 200, {
      items: [timelineEvent()],
      page: { nextCursor: null, limit: 50 },
    });
    return;
  }
  if (
    pathname === `/api/v1/leads/${leadId}/next-action` &&
    request.method === "GET"
  ) {
    json(response, 200, {
      item: null,
      temporalState: "none",
      leadRevision: String(leadRevision),
    });
    return;
  }
  if (
    pathname === `/api/v1/leads/${leadId}/cycles` &&
    request.method === "GET"
  ) {
    json(response, 200, {
      items: [leadDetail(leadId, "Lead Exemplo").latestCycle],
      page: { nextCursor: null, limit: 25 },
    });
    return;
  }
  if (
    pathname === `/api/v1/leads/${leadId}/notes` &&
    request.method === "POST"
  ) {
    if (!validLeadMutationHeaders(request)) {
      authError(response, 428, "If-Match and Idempotency-Key are required.");
      return;
    }
    await readJson(request);
    if (conflictNextLeadMutation) {
      conflictNextLeadMutation = false;
      authError(response, 412, "Lead revision conflict.");
      return;
    }
    leadRevision += 1;
    json(
      response,
      201,
      { id: "00000000-0000-4000-8000-000000000015" },
      { ETag: `"lead:${leadId}:${leadRevision}"` },
    );
    return;
  }
  authError(response, 404, "Not found.");
}

function tenantRequest(request: IncomingMessage): {
  session: Session | undefined;
  organizationId: string | undefined;
} {
  const authorization = request.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  return {
    session: accessToken ? sessionsByAccess.get(accessToken) : undefined,
    organizationId:
      typeof request.headers["x-organization-id"] === "string"
        ? request.headers["x-organization-id"]
        : undefined,
  };
}

function validLeadMutationHeaders(request: IncomingMessage): boolean {
  return (
    request.headers["if-match"] === `"lead:${leadId}:${leadRevision}"` &&
    typeof request.headers["idempotency-key"] === "string"
  );
}

function leadDetail(id: string, displayName: string) {
  const attribution = {
    source: "manual",
    sourceDetail: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    receivedAt: "2026-07-20T12:00:00.000Z",
  };
  return {
    id,
    displayName,
    primaryPhone: "+5511999999999",
    email: "lead@example.test",
    companyName: "Empresa Exemplo",
    instagram: null,
    city: "São Paulo",
    serviceInterest: "Consultoria",
    responsibleMembershipId: "00000000-0000-4000-8000-000000000003",
    status: "active",
    stage: leadStage,
    latestCycleNumber: "1",
    returnReviewPending: false,
    revision: String(leadRevision),
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-28T15:00:00.000Z",
    initialAttribution: attribution,
    lastAttribution: attribution,
    nextAction: null,
    latestEntry: {
      id: entryId,
      sequence: "1",
      intakeChannel: "manual",
      source: "manual",
      receivedAt: "2026-07-20T12:00:00.000Z",
    },
    latestCycle: {
      id: cycleId,
      cycleNumber: "1",
      openingReason: "created",
      startingStage: "new",
      openedByMembershipId: "00000000-0000-4000-8000-000000000003",
      openedAt: "2026-07-20T12:00:00.000Z",
      closedByMembershipId: null,
      closedAt: null,
      closingStatus: null,
      stageAtClose: null,
      lostReason: null,
      archiveReason: null,
      reasonNote: null,
    },
    pendingReturn: null,
    counts: { timeline: 1, cycles: 1, activities: 0, notes: 0 },
  };
}

function leadView(id: string, displayName: string) {
  const lead = leadDetail(id, displayName);
  const { latestEntry, latestCycle, pendingReturn, counts, ...view } = lead;
  void [latestEntry, latestCycle, pendingReturn, counts];
  return view;
}

function leadListItem(
  lead: Pick<
    ReturnType<typeof leadDetail>,
    | "id"
    | "displayName"
    | "primaryPhone"
    | "email"
    | "companyName"
    | "responsibleMembershipId"
    | "status"
    | "stage"
    | "latestEntry"
    | "revision"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    id: lead.id,
    displayName: lead.displayName,
    primaryPhone: lead.primaryPhone,
    email: lead.email,
    companyName: lead.companyName,
    responsibleMembershipId: lead.responsibleMembershipId,
    status: lead.status,
    stage: lead.stage,
    source: "manual",
    lastEntryAt: lead.latestEntry.receivedAt,
    nextAction: null,
    temporalState: "none",
    returnPending: false,
    revision: lead.revision,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

function workLeadDetail() {
  return {
    ...leadDetail(workLeadId, "Lead de Follow-up"),
    revision: String(workLeadRevision),
    nextAction: workLeadCompleted
      ? null
      : {
          id: workActionId,
          type: "call",
          description: "Retornar contato comercial",
          dueAt: "2026-07-29T12:00:00.000Z",
          responsibleMembershipId: "00000000-0000-4000-8000-000000000003",
          status: "pending",
          revision: "2",
        },
  };
}

function workLeadListItem(lead: ReturnType<typeof workLeadDetail>) {
  return {
    ...leadListItem(lead),
    nextAction: lead.nextAction,
    temporalState: "overdue",
  };
}

function timelineEvent() {
  return {
    id: "00000000-0000-4000-8000-000000000014",
    sequence: "1",
    eventType: "lead.created",
    actorMembershipId: null,
    leadEntryId: entryId,
    previousResponsibleMembershipId: null,
    newResponsibleMembershipId: null,
    changedFields: null,
    cycleId,
    returnReviewId: null,
    previousStatus: null,
    newStatus: "active",
    previousStage: null,
    newStage: "new",
    lostReason: null,
    archiveReason: null,
    activityId: null,
    noteId: null,
    nextActionId: null,
    previousNextActionStatus: null,
    newNextActionStatus: null,
    previousDueAt: null,
    newDueAt: null,
    nextActionRevision: null,
    nextActionCancellationReason: null,
    activity: null,
    note: null,
    nextAction: null,
    occurredAt: "2026-07-20T12:00:00.000Z",
  };
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function serveStatic(
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const requested = path.resolve(dist, `.${pathname}`);
  let filename = requested.startsWith(dist)
    ? requested
    : path.join(dist, "index.html");
  try {
    if ((await stat(filename)).isDirectory())
      filename = path.join(filename, "index.html");
  } catch {
    filename = path.join(dist, "index.html");
  }
  const content = await readFile(filename);
  response.writeHead(200, {
    "Content-Type":
      contentTypes[path.extname(filename)] ?? "application/octet-stream",
    "Cache-Control": filename.endsWith("index.html")
      ? "no-store"
      : "public, max-age=31536000",
  });
  response.end(content);
}

export async function startWebSessionServer() {
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      if (url.pathname === "/__test/reset" && request.method === "POST") {
        sessionsByRefresh.clear();
        sessionsByAccess.clear();
        retiredRefreshFamilies.clear();
        refreshCount = 0;
        sequence = 0;
        leadRevision = 3;
        leadStage = "qualification";
        conflictNextLeadMutation = false;
        pipelineContinuationFails = false;
        pipelineConflictStatus = null;
        pipelineUncertainOnce = false;
        completedPipelineMoves.clear();
        workLeadRevision = 3;
        workLeadCompleted = false;
        completedWorkActions.clear();
        metricsStatus = null;
        metricsMode = "default";
        metricsRequests = 0;
        metricsDelayMs = 0;
        createMode = "new";
        createDelayMs = 0;
        completedLeadCreates.clear();
        createRequestKeys.length = 0;
        createHadIfMatch = false;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/pipeline-continuation-fail" &&
        request.method === "POST"
      ) {
        pipelineContinuationFails = true;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/pipeline-conflict-409" &&
        request.method === "POST"
      ) {
        pipelineConflictStatus = 409;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/pipeline-conflict-412" &&
        request.method === "POST"
      ) {
        pipelineConflictStatus = 412;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/pipeline-uncertain" &&
        request.method === "POST"
      ) {
        pipelineUncertainOnce = true;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/lead-conflict" &&
        request.method === "POST"
      ) {
        conflictNextLeadMutation = true;
        json(response, 200, { ok: true });
        return;
      }
      if (url.pathname === "/__test/state" && request.method === "GET") {
        json(response, 200, {
          refreshCount,
          activeRefreshTokens: sessionsByRefresh.size,
          metricsRequests,
          createRequests: createRequestKeys.length,
          createKeyReused:
            createRequestKeys.length > 1 &&
            new Set(createRequestKeys).size < createRequestKeys.length,
          createHadIfMatch,
        });
        return;
      }
      if (
        url.pathname === "/__test/create-delay" &&
        request.method === "POST"
      ) {
        createDelayMs = 800;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname.startsWith("/__test/create-") &&
        request.method === "POST"
      ) {
        const mode = url.pathname.slice("/__test/create-".length);
        createMode =
          mode === "existing" || mode === "uncertain" || mode === "conflict"
            ? mode
            : "new";
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname.startsWith("/__test/metrics-status-") &&
        request.method === "POST"
      ) {
        const status = Number(
          url.pathname.slice("/__test/metrics-status-".length),
        );
        metricsStatus =
          status === 400 ||
          status === 401 ||
          status === 403 ||
          status === 429 ||
          status === 500 ||
          status === 503
            ? status
            : null;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/metrics-delay" &&
        request.method === "POST"
      ) {
        metricsDelayMs = 800;
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/metrics-zeros" &&
        request.method === "POST"
      ) {
        metricsMode = "zeros";
        json(response, 200, { ok: true });
        return;
      }
      if (
        url.pathname === "/__test/metrics-future-source" &&
        request.method === "POST"
      ) {
        metricsMode = "future-source";
        json(response, 200, { ok: true });
        return;
      }
      if (url.pathname === "/__test/expire" && request.method === "POST") {
        sessionsByRefresh.clear();
        sessionsByAccess.clear();
        retiredRefreshFamilies.clear();
        json(response, 200, { ok: true });
        return;
      }
      if (url.pathname.startsWith("/api/v1/")) {
        await handleApi(request, response, url.pathname);
        return;
      }
      await serveStatic(response, url.pathname);
    })().catch(() => {
      json(response, 500, { statusCode: 500, message: "Test server failure." });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return async () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
}
