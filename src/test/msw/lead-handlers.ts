import { HttpResponse, http } from "msw";

export const testLeadId = "00000000-0000-4000-8000-000000000010";
export const testMemberId = "00000000-0000-4000-8000-000000000011";
const cycleId = "00000000-0000-4000-8000-000000000012";
const entryId = "00000000-0000-4000-8000-000000000013";
const eventId = "00000000-0000-4000-8000-000000000014";

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
} as const;

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
  } = {},
) {
  return [
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
    http.get("/api/v1/members", () =>
      HttpResponse.json({
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
      }),
    ),
    http.get(`/api/v1/leads/${testLeadId}`, () => {
      if (options.detailStatus && options.detailStatus !== 200)
        return HttpResponse.json(
          { statusCode: options.detailStatus, message: "Detail unavailable" },
          { status: options.detailStatus },
        );
      return HttpResponse.json(testLead, {
        headers: { ETag: `"lead:${testLeadId}:3"` },
      });
    }),
    http.get(`/api/v1/leads/${testLeadId}/timeline`, () =>
      HttpResponse.json({
        items: [
          {
            id: eventId,
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
        items: [testLead.latestCycle],
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
        if (request.headers.get("if-match") !== `"lead:${testLeadId}:3"`)
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
    ].map((suffix) =>
      http.post(`/api/v1/leads/${testLeadId}${suffix}`, ({ request }) => {
        options.onMutation?.(request);
        if (options.mutationStatus && options.mutationStatus !== 201)
          return HttpResponse.json(
            { statusCode: options.mutationStatus, message: "Mutation failed" },
            { status: options.mutationStatus },
          );
        if (
          request.headers.get("if-match") !== `"lead:${testLeadId}:3"` ||
          !request.headers.has("idempotency-key")
        )
          return HttpResponse.json(
            { statusCode: 428, message: "Headers required" },
            { status: 428 },
          );
        return HttpResponse.json(
          { id: "00000000-0000-4000-8000-000000000015" },
          { status: 201, headers: { ETag: `"lead:${testLeadId}:4"` } },
        );
      }),
    ),
  ];
}
