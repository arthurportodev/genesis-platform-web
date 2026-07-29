import {
  leadReturnReviewQueueResponseSchema,
  leadWorkListResponseSchema,
  type LeadDetail,
  type LeadWorkItem,
} from "@/features/leads/api/lead-contracts";
import { createLeadSnapshot } from "@/features/leads/api/lead-snapshot";
import {
  assertAssignmentPreflight,
  assertDismissPreflight,
  assertNextActionPreflight,
} from "@/features/leads/api/lead-work-preflight";
import {
  composeLeadReturnReviewPages,
  composeLeadWorkPages,
} from "@/features/leads/model/lead-work";

const leadId = "00000000-0000-4000-8000-000000000010";
const actionId = "00000000-0000-4000-8000-000000000020";
const reviewId = "00000000-0000-4000-8000-000000000030";
const cycleId = "00000000-0000-4000-8000-000000000040";
const entryId = "00000000-0000-4000-8000-000000000050";
const membershipId = "00000000-0000-4000-8000-000000000060";

function rawItem(revision = "3") {
  return {
    id: leadId,
    displayName: "Lead Exemplo",
    primaryPhone: "+5511999999999",
    email: "lead@example.test",
    companyName: "Empresa",
    responsibleMembershipId: membershipId,
    status: "active",
    stage: "qualification",
    source: "manual",
    lastEntryAt: "2026-07-29T10:00:00.000Z",
    nextAction: {
      id: actionId,
      type: "call",
      description: "Retornar contato",
      dueAt: "2026-07-29T12:00:00.000Z",
      responsibleMembershipId: membershipId,
      status: "pending",
      revision: "2",
    },
    temporalState: "today",
    returnPending: false,
    revision,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  } as const;
}

function page(item: unknown = rawItem(), cursor: string | null = null) {
  return leadWorkListResponseSchema.parse({
    items: [item],
    page: {
      nextCursor: cursor,
      limit: 25,
      total: 1,
      asOf: "2026-07-29T12:00:00.000Z",
    },
  });
}

function detailFor(item: LeadWorkItem, closed = false) {
  const lead = {
    ...item,
    primaryPhone: "+5511999999999",
    email: "lead@example.test",
    instagram: null,
    city: null,
    serviceInterest: null,
    status: closed ? "won" : item.status,
    latestCycleNumber: "1",
    returnReviewPending: closed,
    initialAttribution: {
      source: "manual",
      sourceDetail: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      receivedAt: item.createdAt,
    },
    lastAttribution: {
      source: "manual",
      sourceDetail: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      receivedAt: item.lastEntryAt,
    },
    latestEntry: {
      id: entryId,
      sequence: "1",
      intakeChannel: "manual",
      source: "manual",
      receivedAt: item.lastEntryAt,
    },
    latestCycle: {
      id: cycleId,
      cycleNumber: "1",
      openingReason: "created",
      startingStage: "new",
      openedByMembershipId: membershipId,
      openedAt: item.createdAt,
      closedByMembershipId: closed ? membershipId : null,
      closedAt: closed ? item.updatedAt : null,
      closingStatus: closed ? "won" : null,
      stageAtClose: closed ? item.stage : null,
      lostReason: null,
      archiveReason: null,
      reasonNote: null,
    },
    pendingReturn: closed
      ? {
          id: reviewId,
          cycleId,
          entryCount: "1",
          openedAt: item.updatedAt,
          updatedAt: item.updatedAt,
        }
      : null,
    counts: { timeline: 1, cycles: 1, activities: 0, notes: 0 },
  } as LeadDetail;
  return {
    lead,
    snapshot: createLeadSnapshot('"opaque-etag"', lead.id, lead.revision),
  };
}

it("projeta a resposta da fila sem telefone ou email", () => {
  const parsed = page();
  expect(parsed.items[0]).not.toHaveProperty("primaryPhone");
  expect(parsed.items[0]).not.toHaveProperty("email");
  expect(JSON.stringify(parsed.items)).not.toContain("+5511999999999");
  expect(JSON.stringify(parsed.items)).not.toContain("lead@example.test");
});

it("deduplica por Lead e prefere a maior revisão sem alterar o total", () => {
  const first = page(rawItem("3"), "next");
  const second = leadWorkListResponseSchema.parse({
    items: [{ ...rawItem("4"), displayName: "Lead Atualizado" }],
    page: {
      nextCursor: null,
      limit: 25,
      total: 7,
      asOf: "2026-07-29T12:05:00.000Z",
    },
  });
  const view = composeLeadWorkPages([first, second]);
  expect(view.items).toHaveLength(1);
  expect(view.items[0]?.displayName).toBe("Lead Atualizado");
  expect(view.total).toBe(7);
});

it("não funde reviews diferentes do mesmo Lead", () => {
  const response = (id: string) =>
    leadReturnReviewQueueResponseSchema.parse({
      items: [
        {
          lead: { ...rawItem(), status: "won", returnPending: true },
          review: {
            id,
            cycleId,
            entryCount: "1",
            openedAt: "2026-07-29T10:00:00.000Z",
            updatedAt: "2026-07-29T10:00:00.000Z",
            firstEntry: {
              id: entryId,
              source: "manual",
              receivedAt: "2026-07-29T10:00:00.000Z",
            },
            latestEntry: {
              id: entryId,
              source: "manual",
              receivedAt: "2026-07-29T10:00:00.000Z",
            },
          },
        },
      ],
      page: {
        nextCursor: null,
        limit: 25,
        total: 2,
        asOf: "2026-07-29T12:00:00.000Z",
      },
    });
  const otherReviewId = "00000000-0000-4000-8000-000000000031";
  expect(
    composeLeadReturnReviewPages([response(reviewId), response(otherReviewId)])
      .items,
  ).toHaveLength(2);
});

it("exige detalhe e Next Action exatamente compatíveis", () => {
  const item = page().items[0];
  const current = detailFor(item);
  expect(() => assertNextActionPreflight(current, item)).not.toThrow();
  expect(() =>
    assertNextActionPreflight(
      {
        ...current,
        lead: {
          ...current.lead,
          nextAction: current.lead.nextAction
            ? { ...current.lead.nextAction, revision: "3" }
            : null,
        },
      },
      item,
    ),
  ).toThrow(/próxima ação mudou/iu);
});

it("valida assignment e dismiss contra estado atual", () => {
  const unassigned = page({
    ...rawItem(),
    responsibleMembershipId: null,
    nextAction: rawItem().nextAction
      ? { ...rawItem().nextAction, responsibleMembershipId: null }
      : null,
  }).items[0];
  expect(() =>
    assertAssignmentPreflight(
      detailFor(unassigned),
      unassigned,
      membershipId,
      new Set([membershipId]),
    ),
  ).not.toThrow();

  const response = leadReturnReviewQueueResponseSchema.parse({
    items: [
      {
        lead: { ...rawItem(), status: "won", returnPending: true },
        review: {
          id: reviewId,
          cycleId,
          entryCount: "1",
          openedAt: "2026-07-29T10:00:00.000Z",
          updatedAt: "2026-07-29T10:00:00.000Z",
          firstEntry: {
            id: entryId,
            source: "manual",
            receivedAt: "2026-07-29T10:00:00.000Z",
          },
          latestEntry: {
            id: entryId,
            source: "manual",
            receivedAt: "2026-07-29T10:00:00.000Z",
          },
        },
      },
    ],
    page: {
      nextCursor: null,
      limit: 25,
      total: 1,
      asOf: "2026-07-29T12:00:00.000Z",
    },
  });
  expect(() =>
    assertDismissPreflight(
      detailFor(response.items[0].lead, true),
      response.items[0],
    ),
  ).not.toThrow();
});
