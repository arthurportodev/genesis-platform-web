import { HttpResponse, http } from "msw";

import type {
  LeadListItem,
  LeadDetail,
  LeadMetricsSummary,
  LeadStage,
} from "@/features/leads/api/lead-contracts";

export const testLeadId = "00000000-0000-4000-8000-000000000010";
export const testMemberId = "00000000-0000-4000-8000-000000000011";
export const testPipelineId = "00000000-0000-4000-8000-000000000101";
export const testPipelineStageIds = [
  "00000000-0000-4000-8000-000000000102",
  "00000000-0000-4000-8000-000000000103",
  "00000000-0000-4000-8000-000000000104",
  "00000000-0000-4000-8000-000000000105",
  "00000000-0000-4000-8000-000000000106",
] as const;
export const testPipelines = [
  {
    id: testPipelineId,
    name: "Pipeline comercial",
    isDefault: true,
    revision: "1",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    stages: [
      "Novo",
      "Qualificação",
      "Diagnóstico",
      "Proposta",
      "Negociação",
    ].map((name, position) => ({
      id: testPipelineStageIds[position],
      name,
      position,
      archivedAt: null,
    })),
  },
  {
    id: "00000000-0000-4000-8000-000000000110",
    name: "Parcerias",
    isDefault: false,
    revision: "1",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    stages: [
      {
        id: "00000000-0000-4000-8000-000000000111",
        name: "Recebido",
        position: 0,
        archivedAt: null,
      },
    ],
  },
] as const;
const cycleId = "00000000-0000-4000-8000-000000000012";
const entryId = "00000000-0000-4000-8000-000000000013";
const eventId = "00000000-0000-4000-8000-000000000014";

export const testMetricsSummary: LeadMetricsSummary = {
  asOf: "2026-07-29T16:40:00.000Z",
  timeZone: "America/Belem",
  snapshot: {
    active: 42,
    unassigned: 7,
    overdue: 5,
    withoutNextAction: 9,
    pendingReturns: 2,
  },
  period: {
    from: "2026-06-30" as LeadMetricsSummary["period"]["from"],
    to: "2026-07-29" as LeadMetricsSummary["period"]["to"],
    created: 30,
    won: 12,
    lost: 8,
    createdBySource: [
      { source: "campaign", count: 12 },
      { source: "landing_page", count: 10 },
      { source: "manual", count: 8 },
    ],
  },
};

export const testLead = {
  id: testLeadId,
  displayName: "Lead Exemplo",
  primaryPhone: "+5511999999999",
  email: "lead@example.test",
  companyName: "Empresa Exemplo",
  instagram: null,
  city: "São Paulo",
  serviceInterest: "Consultoria",
  responsibleMembershipId: "00000000-0000-4000-8000-000000000003",
  status: "active",
  stage: "qualification",
  pipelineId: testPipelineId,
  pipelineStageId: testPipelineStageIds[1],
  pipelineName: "Pipeline comercial",
  pipelineStageName: "Qualificação",
  latestCycleNumber: "1",
  returnReviewPending: false,
  revision: "3",
  createdAt: "2026-07-20T12:00:00.000Z",
  updatedAt: "2026-07-28T15:00:00.000Z",
  initialAttribution: {
    source: "manual",
    sourceDetail: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    receivedAt: "2026-07-20T12:00:00.000Z",
  },
  lastAttribution: {
    source: "manual",
    sourceDetail: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    receivedAt: "2026-07-20T12:00:00.000Z",
  },
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
    pipelineId: testPipelineId,
    pipelineStageId: testPipelineStageIds[1],
    startingPipelineStageId: testPipelineStageIds[0],
    startingStageName: "Novo",
    openedByMembershipId: "00000000-0000-4000-8000-000000000003",
    openedAt: "2026-07-20T12:00:00.000Z",
    closedByMembershipId: null,
    closedAt: null,
    closingStatus: null,
    stageAtClose: null,
    stageAtClosePipelineStageId: null,
    stageAtCloseName: null,
    lostReason: null,
    archiveReason: null,
    reasonNote: null,
    expectedValueMinor: "2500000",
  },
  pendingReturn: null,
  counts: { timeline: 1, cycles: 1, activities: 0, notes: 0 },
} as const;

const {
  latestEntry: _latestEntry,
  latestCycle: _latestCycle,
  pendingReturn: _pendingReturn,
  counts: _counts,
  ...testLeadViewValue
} = testLead;
void [_latestEntry, _latestCycle, _pendingReturn, _counts];
export const testLeadView = testLeadViewValue;

export function testLeadListItem(
  overrides: Partial<LeadListItem> = {},
): LeadListItem {
  return { ...(listItem() as LeadListItem), ...overrides };
}

function listItem() {
  return {
    id: testLead.id,
    displayName: testLead.displayName,
    primaryPhone: testLead.primaryPhone,
    email: testLead.email,
    companyName: testLead.companyName,
    responsibleMembershipId: testLead.responsibleMembershipId,
    status: testLead.status,
    stage: testLead.stage,
    pipelineId: testLead.pipelineId,
    pipelineStageId: testLead.pipelineStageId,
    pipelineName: testLead.pipelineName,
    pipelineStageName: testLead.pipelineStageName,
    expectedValueMinor: "2500000",
    source: "manual",
    lastEntryAt: testLead.latestEntry.receivedAt,
    nextAction: null,
    temporalState: "none",
    returnPending: false,
    revision: testLead.revision,
    createdAt: testLead.createdAt,
    updatedAt: testLead.updatedAt,
  };
}

function requireTenant(
  request: Request,
  organizationId = "00000000-0000-4000-8000-000000000002",
) {
  return (
    request.headers.has("authorization") &&
    request.headers.get("x-organization-id") === organizationId
  );
}

export function createLeadHandlers(
  options: {
    listStatus?: number;
    detailStatus?: number;
    onList?: (url: URL) => void;
    onMutation?: (request: Request) => void;
    organizationId?: string;
    mutationStatus?: number;
    nextCursor?: string | null;
    kanbanStatus?: number;
    kanbanContinuationStatus?: number;
    kanbanNextCursor?: string | null;
    onKanban?: (url: URL) => void;
    onDetail?: () => void;
    detailEmail?: string | null;
    moveDelayMs?: number;
    moveNetworkFailures?: number;
    metricsStatus?: number;
    metricsRefreshStatus?: number;
    metricsResponse?: LeadMetricsSummary | Record<string, unknown>;
    onMetrics?: (url: URL, request: Request) => void;
    createStatus?:
      200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;
    createReplayed?: boolean;
    createNetworkFailures?: number;
    createDelayMs?: number;
    onCreate?: (request: Request, body: unknown) => void;
    onMembers?: () => void;
    kanbanItemOverrides?: Partial<LeadListItem>;
    timelineFinancial?: boolean;
    timelineStageNames?: { previous: string; next: string };
    detailOverrides?: Partial<LeadDetail>;
    pipelineMutationStatus?: 200 | 403 | 409 | 412;
    onPipelineMutation?: (request: Request, body: unknown) => void;
    cyclesEmpty?: boolean;
  } = {},
) {
  let currentStage: LeadStage = testLead.stage;
  let currentStageId: string = testLead.pipelineStageId;
  let currentRevision: string = testLead.revision;
  let remainingMoveNetworkFailures = options.moveNetworkFailures ?? 0;
  let metricsRequests = 0;
  let remainingCreateNetworkFailures = options.createNetworkFailures ?? 0;
  const kanbanResponse = (stage?: string) => {
    const stages = stage
      ? [stage]
      : ["new", "qualification", "diagnosis", "proposal", "negotiation"];
    const currentItem = testLeadListItem({
      ...options.kanbanItemOverrides,
      stage: currentStage,
      revision: currentRevision,
    });
    const expectedValueTotalMinor = currentItem.expectedValueMinor ?? "0";
    const withoutExpectedValue =
      currentItem.expectedValueMinor === null ? 1 : 0;
    return {
      asOf: "2026-07-28T16:00:00.000Z",
      currency: "BRL",
      expectedValueTotalMinor,
      withoutExpectedValue,
      columns: stages.map((candidate) => ({
        stage: candidate,
        total: candidate === currentStage ? 1 : 0,
        expectedValueTotalMinor:
          candidate === currentStage ? expectedValueTotalMinor : "0",
        withoutExpectedValue:
          candidate === currentStage ? withoutExpectedValue : 0,
        items: candidate === currentStage ? [currentItem] : [],
        page: {
          limit: 20,
          nextCursor:
            candidate === currentStage
              ? (options.kanbanNextCursor ?? null)
              : null,
        },
      })),
    };
  };
  const dynamicKanbanResponse = (
    pipelineId: string,
    pipelineStageId?: string,
  ) => {
    const pipeline =
      testPipelines.find((candidate) => candidate.id === pipelineId) ??
      testPipelines[0];
    const selectedStages = pipelineStageId
      ? pipeline.stages.filter((stage) => stage.id === pipelineStageId)
      : pipeline.stages;
    const currentItem = testLeadListItem({
      ...options.kanbanItemOverrides,
      stage: currentStage,
      pipelineId: pipeline.id,
      pipelineStageId: currentStageId,
      pipelineName: pipeline.name,
      pipelineStageName:
        pipeline.stages.find((stage) => stage.id === currentStageId)?.name ??
        null,
      revision: currentRevision,
    });
    const expectedValueTotalMinor = currentItem.expectedValueMinor ?? "0";
    const withoutExpectedValue =
      currentItem.expectedValueMinor === null ? 1 : 0;
    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        isDefault: pipeline.isDefault,
        revision: pipeline.revision,
      },
      currency: "BRL",
      expectedValueTotalMinor,
      withoutExpectedValue,
      columns: selectedStages.map((stage) => ({
        stage: { id: stage.id, name: stage.name, position: stage.position },
        total:
          pipeline.id === testLead.pipelineId && stage.id === currentStageId
            ? 1
            : 0,
        expectedValueTotalMinor:
          pipeline.id === testLead.pipelineId && stage.id === currentStageId
            ? expectedValueTotalMinor
            : "0",
        withoutExpectedValue:
          pipeline.id === testLead.pipelineId && stage.id === currentStageId
            ? withoutExpectedValue
            : 0,
        items:
          pipeline.id === testLead.pipelineId && stage.id === currentStageId
            ? [currentItem]
            : [],
        page: {
          limit: 20,
          nextCursor:
            !pipelineStageId &&
            pipeline.id === testLead.pipelineId &&
            stage.id === currentStageId
              ? (options.kanbanNextCursor ?? null)
              : null,
        },
      })),
    };
  };
  return [
    http.post("/api/v1/leads", async ({ request }) => {
      const body = await request.clone().json();
      options.onCreate?.(request, body);
      if (remainingCreateNetworkFailures > 0) {
        remainingCreateNetworkFailures -= 1;
        return HttpResponse.error();
      }
      if (options.createDelayMs)
        await new Promise((resolve) =>
          globalThis.setTimeout(resolve, options.createDelayMs),
        );
      if (
        !requireTenant(request, options.organizationId) ||
        !request.headers.has("idempotency-key") ||
        request.headers.has("x-genesis-if-match")
      )
        return HttpResponse.json(
          { statusCode: 400, message: "Invalid create headers" },
          { status: 400 },
        );
      const status = options.createStatus ?? 201;
      if (status === 204)
        return new HttpResponse(null, {
          status,
          headers: options.createReplayed
            ? { "Idempotency-Replayed": "true" }
            : undefined,
        });
      if (status !== 200 && status !== 201)
        return HttpResponse.json(
          { statusCode: status, message: "Create unavailable" },
          { status },
        );
      return HttpResponse.json(testLeadView, {
        status,
        headers: {
          ETag: `"lead:${testLeadId}:3"`,
          ...(status === 201
            ? { Location: `/api/v1/leads/${testLeadId}` }
            : {}),
          ...(options.createReplayed ? { "Idempotency-Replayed": "true" } : {}),
        },
      });
    }),
    http.get("/api/v1/leads", ({ request }) => {
      options.onList?.(new URL(request.url));
      if (!requireTenant(request, options.organizationId))
        return HttpResponse.json(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        );
      if (options.listStatus && options.listStatus !== 200)
        return HttpResponse.json(
          { statusCode: options.listStatus, message: "List unavailable" },
          { status: options.listStatus },
        );
      return HttpResponse.json({
        items: [listItem()],
        page: {
          nextCursor: options.nextCursor ?? null,
          limit: 25,
          total: 1,
          asOf: "2026-07-28T16:00:00.000Z",
        },
      });
    }),
    http.get("/api/v1/leads/kanban", ({ request }) => {
      const url = new URL(request.url);
      options.onKanban?.(url);
      if (!requireTenant(request, options.organizationId))
        return HttpResponse.json(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        );
      const stage = url.searchParams.get("stage") ?? undefined;
      const status = stage
        ? options.kanbanContinuationStatus
        : options.kanbanStatus;
      if (status && status !== 200)
        return HttpResponse.json(
          { statusCode: status, message: "Kanban unavailable" },
          { status },
        );
      return HttpResponse.json(kanbanResponse(stage));
    }),
    http.get("/api/v1/pipelines", () => HttpResponse.json(testPipelines)),
    http.all("/api/v1/pipelines/:pipelineId", async ({ request, params }) => {
      if (request.method === "GET") return;
      const body = await request
        .clone()
        .json()
        .catch(() => undefined);
      options.onPipelineMutation?.(request, body);
      const status = options.pipelineMutationStatus ?? 200;
      if (status !== 200)
        return HttpResponse.json(
          { statusCode: status, message: "Pipeline mutation failed" },
          { status },
        );
      const pipeline =
        testPipelines.find((candidate) => candidate.id === params.pipelineId) ??
        testPipelines[0];
      return HttpResponse.json(
        { ...pipeline, revision: "2" },
        {
          status: request.method === "PUT" ? 201 : 200,
          headers: { ETag: `"pipeline:${pipeline.id}:2"` },
        },
      );
    }),
    http.all(
      "/api/v1/pipelines/:pipelineId/stages/:stagePath",
      async ({ request, params }) => {
        const body = await request
          .clone()
          .json()
          .catch(() => undefined);
        options.onPipelineMutation?.(request, body);
        const status = options.pipelineMutationStatus ?? 200;
        if (status !== 200)
          return HttpResponse.json(
            { statusCode: status, message: "Pipeline mutation failed" },
            { status },
          );
        const pipeline =
          testPipelines.find(
            (candidate) => candidate.id === params.pipelineId,
          ) ?? testPipelines[0];
        return HttpResponse.json(
          { ...pipeline, revision: "2" },
          { headers: { ETag: `"pipeline:${pipeline.id}:2"` } },
        );
      },
    ),
    http.post(
      "/api/v1/pipelines/:pipelineId/stages/:stageId/archive",
      ({ request, params }) => {
        options.onPipelineMutation?.(request, undefined);
        const status = options.pipelineMutationStatus ?? 200;
        if (status !== 200)
          return HttpResponse.json(
            { statusCode: status, message: "Pipeline mutation failed" },
            { status },
          );
        const pipeline =
          testPipelines.find(
            (candidate) => candidate.id === params.pipelineId,
          ) ?? testPipelines[0];
        return HttpResponse.json(
          { ...pipeline, revision: "2" },
          { headers: { ETag: `"pipeline:${pipeline.id}:2"` } },
        );
      },
    ),
    http.get("/api/v1/pipelines/:pipelineId/kanban", ({ request, params }) => {
      const url = new URL(request.url);
      options.onKanban?.(url);
      const pipelineId = String(params.pipelineId);
      if (!testPipelines.some((pipeline) => pipeline.id === pipelineId))
        return HttpResponse.json(
          { statusCode: 404, message: "Not found" },
          { status: 404 },
        );
      const stageId = url.searchParams.get("pipelineStageId") ?? undefined;
      const status = stageId
        ? options.kanbanContinuationStatus
        : options.kanbanStatus;
      if (status && status !== 200)
        return HttpResponse.json(
          { statusCode: status, message: "Kanban unavailable" },
          { status },
        );
      return HttpResponse.json(dynamicKanbanResponse(pipelineId, stageId));
    }),
    http.get("/api/v1/leads/metrics/summary", ({ request }) => {
      metricsRequests += 1;
      const url = new URL(request.url);
      options.onMetrics?.(url, request);
      if (!requireTenant(request, options.organizationId))
        return HttpResponse.json(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        );
      const status =
        metricsRequests > 1
          ? (options.metricsRefreshStatus ?? options.metricsStatus)
          : options.metricsStatus;
      if (status && status !== 200)
        return HttpResponse.json(
          { statusCode: status, message: "Metrics unavailable" },
          { status },
        );
      return HttpResponse.json(options.metricsResponse ?? testMetricsSummary, {
        headers: { "Cache-Control": "no-store" },
      });
    }),
    http.get("/api/v1/members", () => {
      options.onMembers?.();
      return HttpResponse.json({
        items: [
          {
            id: testMemberId,
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
    }),
    http.get(`/api/v1/leads/${testLeadId}`, () => {
      options.onDetail?.();
      if (options.detailStatus && options.detailStatus !== 200)
        return HttpResponse.json(
          { statusCode: options.detailStatus, message: "Detail unavailable" },
          { status: options.detailStatus },
        );
      return HttpResponse.json(
        {
          ...testLead,
          email:
            options.detailEmail === undefined
              ? testLead.email
              : options.detailEmail,
          stage: currentStage,
          pipelineStageId: currentStageId,
          pipelineStageName:
            testPipelines[0].stages.find((stage) => stage.id === currentStageId)
              ?.name ?? null,
          revision: currentRevision,
          ...options.detailOverrides,
        },
        {
          headers: { ETag: `"lead:${testLeadId}:${currentRevision}"` },
        },
      );
    }),
    http.get(`/api/v1/leads/${testLeadId}/timeline`, () =>
      HttpResponse.json({
        items: [
          {
            id: eventId,
            sequence: "1",
            eventType: options.timelineFinancial
              ? "lead.expected_value.changed"
              : options.timelineStageNames
                ? "lead.stage.changed"
                : "lead.created",
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
            previousPipelineStageId: options.timelineStageNames
              ? testPipelineStageIds[1]
              : null,
            previousStageName: options.timelineStageNames?.previous ?? null,
            newPipelineStageId: options.timelineStageNames
              ? testPipelineStageIds[2]
              : testPipelineStageIds[0],
            newStageName: options.timelineStageNames?.next ?? "Novo",
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
            previousExpectedValueMinor: options.timelineFinancial
              ? "2500000"
              : null,
            newExpectedValueMinor: options.timelineFinancial ? "3000000" : null,
            activity: null,
            note: null,
            nextAction: null,
            occurredAt: "2026-07-20T12:00:00.000Z",
          },
        ],
        page: { nextCursor: null, limit: 50 },
      }),
    ),
    http.get(`/api/v1/leads/${testLeadId}/next-action`, () =>
      HttpResponse.json({
        item: null,
        temporalState: "none",
        leadRevision: "3",
      }),
    ),
    http.get(`/api/v1/leads/${testLeadId}/cycles`, () =>
      HttpResponse.json({
        items: options.cyclesEmpty ? [] : [testLead.latestCycle],
        page: { nextCursor: null, limit: 25 },
      }),
    ),
    ...["", "/assignment"].map((suffix) =>
      http.patch(`/api/v1/leads/${testLeadId}${suffix}`, ({ request }) => {
        options.onMutation?.(request);
        if (options.mutationStatus && options.mutationStatus !== 200)
          return HttpResponse.json(
            { statusCode: options.mutationStatus, message: "Mutation failed" },
            { status: options.mutationStatus },
          );
        if (
          request.headers.get("x-genesis-if-match") !== `"lead:${testLeadId}:3"`
        )
          return HttpResponse.json(
            { statusCode: 428, message: "If-Match required" },
            { status: 428 },
          );
        return HttpResponse.json(testLead, {
          headers: { ETag: `"lead:${testLeadId}:4"` },
        });
      }),
    ),
    ...[
      "/activities",
      "/notes",
      "/next-action",
      "/next-action/reschedule",
      "/next-action/complete",
      "/next-action/cancel",
      "/move",
      "/win",
      "/lose",
      "/archive",
      "/reactivate",
      "/return-review/dismiss",
      "/expected-value",
      "/information",
      "/cycles",
    ].map((suffix) =>
      http.post(`/api/v1/leads/${testLeadId}${suffix}`, async ({ request }) => {
        options.onMutation?.(request);
        if (suffix === "/move" && remainingMoveNetworkFailures > 0) {
          remainingMoveNetworkFailures -= 1;
          return HttpResponse.error();
        }
        const expectedStatus =
          suffix === "/move" || suffix === "/expected-value"
            ? 204
            : suffix === "/cycles"
              ? 204
              : suffix === "/information"
                ? 200
                : 201;
        if (options.mutationStatus && options.mutationStatus !== expectedStatus)
          return HttpResponse.json(
            { statusCode: options.mutationStatus, message: "Mutation failed" },
            { status: options.mutationStatus },
          );
        if (
          request.headers.get("x-genesis-if-match") !==
            `"lead:${testLeadId}:${currentRevision}"` ||
          !request.headers.has("idempotency-key")
        )
          return HttpResponse.json(
            { statusCode: 428, message: "Headers required" },
            { status: 428 },
          );
        if (suffix === "/move") {
          if (options.moveDelayMs)
            await new Promise((resolve) =>
              globalThis.setTimeout(resolve, options.moveDelayMs),
            );
          const body = (await request.json()) as { pipelineStageId?: string };
          if (body.pipelineStageId) {
            currentStageId = body.pipelineStageId;
            const index = testPipelineStageIds.indexOf(
              body.pipelineStageId as (typeof testPipelineStageIds)[number],
            );
            const legacy = [
              "new",
              "qualification",
              "diagnosis",
              "proposal",
              "negotiation",
            ] as const;
            if (legacy[index]) currentStage = legacy[index];
          }
          currentRevision = String(BigInt(currentRevision) + 1n);
          return new HttpResponse(null, {
            status: 204,
            headers: { ETag: `"lead:${testLeadId}:${currentRevision}"` },
          });
        }
        if (suffix === "/expected-value") {
          currentRevision = String(BigInt(currentRevision) + 1n);
          return new HttpResponse(null, {
            status: 204,
            headers: { ETag: `"lead:${testLeadId}:${currentRevision}"` },
          });
        }
        if (suffix === "/cycles") {
          currentRevision = String(BigInt(currentRevision) + 1n);
          return new HttpResponse(null, {
            status: 204,
            headers: { ETag: `"lead:${testLeadId}:${currentRevision}"` },
          });
        }
        if (suffix === "/information") {
          currentRevision = String(BigInt(currentRevision) + 2n);
          return HttpResponse.json(
            { ...testLeadView, revision: currentRevision },
            {
              status: 200,
              headers: { ETag: `"lead:${testLeadId}:${currentRevision}"` },
            },
          );
        }
        return HttpResponse.json(
          { id: "00000000-0000-4000-8000-000000000015" },
          { status: 201, headers: { ETag: `"lead:${testLeadId}:4"` } },
        );
      }),
    ),
  ];
}
