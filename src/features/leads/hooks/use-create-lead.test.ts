import type { QueryClient } from "@tanstack/react-query";

import type {
  CreateLeadInput,
  CreateLeadResult,
} from "@/features/leads/api/lead-contracts";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { invalidateLeadCreation } from "@/features/leads/hooks/use-create-lead";
import { testLeadView } from "@/test/msw/lead-handlers";

function setup() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return {
    queryClient: { invalidateQueries } as unknown as QueryClient,
    invalidateQueries,
  };
}

const input: CreateLeadInput = {
  displayName: "Lead sintético",
  primaryPhone: "+5562999999999",
  source: "manual",
};

function keysOf(invalidateQueries: ReturnType<typeof vi.fn>) {
  return invalidateQueries.mock.calls.map(
    ([options]) => (options as { queryKey: readonly unknown[] }).queryKey,
  );
}

describe("invalidateLeadCreation", () => {
  it("invalida projeções de um novo Lead sem responsável", async () => {
    const { queryClient, invalidateQueries } = setup();
    await invalidateLeadCreation(queryClient, "org-a", input, {
      kind: "identified",
      status: 201,
      lead: testLeadView,
      etag: '"opaque"',
      location: `/api/v1/leads/${testLeadView.id}`,
      replayed: false,
    });
    expect(keysOf(invalidateQueries)).toEqual(
      expect.arrayContaining([
        leadQueryKeys.inboxes("org-a"),
        leadQueryKeys.kanbans("org-a"),
        leadQueryKeys.detail("org-a", testLeadView.id),
        leadQueryKeys.timeline("org-a", testLeadView.id),
        leadQueryKeys.metricsRoot("org-a"),
        leadQueryKeys.unassignedQueues("org-a"),
      ]),
    );
  });

  it("limita uma entrada existente às projeções realmente afetadas", async () => {
    const { queryClient, invalidateQueries } = setup();
    const result: CreateLeadResult = {
      kind: "identified",
      status: 200,
      lead: testLeadView,
      etag: '"opaque"',
      location: null,
      replayed: false,
    };
    await invalidateLeadCreation(queryClient, "org-a", input, result);
    const keys = keysOf(invalidateQueries);
    expect(keys).toContainEqual(leadQueryKeys.inboxes("org-a"));
    expect(keys).toContainEqual(leadQueryKeys.kanbans("org-a"));
    expect(keys).not.toContainEqual(leadQueryKeys.metricsRoot("org-a"));
    expect(keys).not.toContainEqual(leadQueryKeys.work("org-a"));
    expect(keys).not.toContainEqual(leadQueryKeys.root("org-a"));
  });

  it("trata replay e pending return de forma conservadora", async () => {
    const { queryClient, invalidateQueries } = setup();
    await invalidateLeadCreation(queryClient, "org-a", input, {
      kind: "identified",
      status: 200,
      lead: { ...testLeadView, returnReviewPending: true },
      etag: '"opaque"',
      location: null,
      replayed: true,
    });
    expect(keysOf(invalidateQueries)).toEqual(
      expect.arrayContaining([
        leadQueryKeys.metricsRoot("org-a"),
        leadQueryKeys.returnReviewQueues("org-a"),
      ]),
    );
  });

  it("mantém o resultado member opaco sem queries administrativas", async () => {
    const { queryClient, invalidateQueries } = setup();
    await invalidateLeadCreation(queryClient, "org-a", input, {
      kind: "opaque",
      status: 204,
      replayed: false,
    });
    expect(keysOf(invalidateQueries)).toEqual([
      leadQueryKeys.inboxes("org-a"),
      leadQueryKeys.kanbans("org-a"),
      leadQueryKeys.myActionsRoot("org-a"),
    ]);
  });
});
