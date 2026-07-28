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
    role: "owner",
  };
  if (!email.startsWith("multi")) return [first];
  return [
    first,
    {
      id: "00000000-0000-4000-8000-000000000004",
      name: "Segunda Organização",
      slug: "segunda-organizacao",
      membershipId: "00000000-0000-4000-8000-000000000005",
      role: "member",
    },
  ];
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
  authError(response, 404, "Not found.");
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
        json(response, 200, { ok: true });
        return;
      }
      if (url.pathname === "/__test/state" && request.method === "GET") {
        json(response, 200, {
          refreshCount,
          activeRefreshTokens: sessionsByRefresh.size,
        });
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
