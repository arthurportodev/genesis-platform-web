import {
  createLeadApi,
  type LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import { leadDetailSchema } from "@/features/leads/api/lead-contracts";
import { createLeadSnapshot } from "@/features/leads/api/lead-snapshot";
import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { createIdempotencyKey } from "@/shared/api/idempotency";
import { testLead, testMemberId } from "@/test/msw/lead-handlers";

const createdId = "00000000-0000-4000-8000-000000000099";

function setup() {
  const request = vi.fn((_path: string, options: { method?: string }) => {
    if (options.method === "PATCH") {
      return {
        data: testLead,
        status: 200,
        etag: '"opaque-lead-etag-4"',
      };
    }
    return {
      data: { id: createdId },
      status: 201,
      etag: '"opaque-lead-etag-4"',
      idempotencyReplayed: false,
    };
  });
  const http = { request } as unknown as AuthenticatedHttpClient;
  const lead = leadDetailSchema.parse(testLead);
  const current = {
    lead,
    snapshot: createLeadSnapshot(
      '"opaque-lead-etag-3"',
      lead.id,
      lead.revision,
    ),
  };
  return { api: createLeadApi(http), current, request };
}

describe("createLeadApi mutations", () => {
  it("maps PATCH updates and assignment with the exact opaque ETag", async () => {
    const { api, current, request } = setup();
    await api.update(current, { displayName: "Nome atualizado" });
    expect(request).toHaveBeenLastCalledWith(`/api/v1/leads/${testLead.id}`, {
      kind: "conditional-mutation",
      method: "PATCH",
      ifMatch: '"opaque-lead-etag-3"',
      body: { displayName: "Nome atualizado" },
    });

    await api.assign(current, testMemberId);
    expect(request).toHaveBeenLastCalledWith(
      `/api/v1/leads/${testLead.id}/assignment`,
      {
        kind: "conditional-mutation",
        method: "PATCH",
        ifMatch: '"opaque-lead-etag-3"',
        body: { responsibleMembershipId: testMemberId },
      },
    );
  });

  it.each<{ intent: LeadIdempotentAction; suffix: string }>([
    {
      intent: {
        action: "activity",
        body: { type: "call", performedAt: "2026-07-28T12:00:00.000Z" },
      },
      suffix: "/activities",
    },
    {
      intent: { action: "note", body: { content: "Nota" } },
      suffix: "/notes",
    },
    {
      intent: {
        action: "next-action-create",
        body: {
          type: "follow_up",
          description: "Retornar",
          dueAt: "2026-07-29T12:00:00.000Z",
        },
      },
      suffix: "/next-action",
    },
    {
      intent: {
        action: "next-action-reschedule",
        body: { dueAt: "2026-07-30T12:00:00.000Z" },
      },
      suffix: "/next-action/reschedule",
    },
    {
      intent: {
        action: "next-action-complete",
        body: { performedAt: "2026-07-28T12:00:00.000Z" },
      },
      suffix: "/next-action/complete",
    },
    {
      intent: { action: "next-action-cancel", body: { note: "Cancelada" } },
      suffix: "/next-action/cancel",
    },
    {
      intent: { action: "move", body: { stage: "proposal" } },
      suffix: "/move",
    },
    { intent: { action: "win", body: {} }, suffix: "/win" },
    {
      intent: { action: "lose", body: { lostReason: "not_now" } },
      suffix: "/lose",
    },
    {
      intent: { action: "archive", body: { archiveReason: "outdated" } },
      suffix: "/archive",
    },
    {
      intent: { action: "reactivate", body: {} },
      suffix: "/reactivate",
    },
    {
      intent: { action: "dismiss-return", body: {} },
      suffix: "/return-review/dismiss",
    },
  ])(
    "maps $intent.action with combined concurrency headers",
    async ({ intent, suffix }) => {
      const { api, current, request } = setup();
      const idempotencyKey = createIdempotencyKey();
      await api.act(current, intent, idempotencyKey);
      expect(request).toHaveBeenCalledWith(
        `/api/v1/leads/${testLead.id}${suffix}`,
        {
          kind: "conditional-idempotent-mutation",
          method: "POST",
          ifMatch: '"opaque-lead-etag-3"',
          idempotencyKey,
          body: intent.body,
        },
      );
    },
  );
});
