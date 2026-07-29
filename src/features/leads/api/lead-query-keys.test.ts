import {
  defaultLeadFilters,
  defaultLeadKanbanFilters,
  defaultLeadMyActionsFilters,
  defaultLeadReturnReviewFilters,
  defaultLeadUnassignedFilters,
} from "@/features/leads/api/lead-filters";
import {
  isLeadKanbanAggregateKey,
  leadQueryKeys,
} from "@/features/leads/api/lead-query-keys";

it("mantém todas as chaves de Lead sob o tenant", () => {
  const organizationId = "00000000-0000-4000-8000-000000000001";
  for (const key of [
    leadQueryKeys.inbox(organizationId, defaultLeadFilters),
    leadQueryKeys.detail(organizationId, "lead"),
    leadQueryKeys.timeline(organizationId, "lead"),
    leadQueryKeys.nextAction(organizationId, "lead"),
    leadQueryKeys.cycles(organizationId, "lead"),
    leadQueryKeys.assignees(organizationId),
    leadQueryKeys.kanban(organizationId, defaultLeadKanbanFilters),
    leadQueryKeys.kanbanColumn(organizationId, defaultLeadKanbanFilters, "new"),
    leadQueryKeys.myActions(organizationId, defaultLeadMyActionsFilters),
    leadQueryKeys.unassignedQueue(organizationId, defaultLeadUnassignedFilters),
    leadQueryKeys.returnReviewQueue(
      organizationId,
      defaultLeadReturnReviewFilters,
    ),
    leadQueryKeys.metrics(organizationId, { kind: "default" }),
  ]) {
    expect(key.slice(0, 3)).toEqual(["organization", organizationId, "leads"]);
  }
});

it("separa Metrics por Organization e período canônico", () => {
  expect(leadQueryKeys.metrics("org-a", { kind: "default" })).toEqual([
    "organization",
    "org-a",
    "leads",
    "metrics",
    { kind: "default" },
  ]);
  expect(leadQueryKeys.metrics("org-a", { kind: "default" })).not.toEqual(
    leadQueryKeys.metrics("org-a", {
      kind: "range",
      from: "2026-07-01" as never,
      to: "2026-07-29" as never,
    }),
  );
  expect(leadQueryKeys.metrics("org-a", { kind: "default" })).not.toEqual(
    leadQueryKeys.metrics("org-b", { kind: "default" }),
  );
  expect(() => leadQueryKeys.metricsRoot("")).toThrow(/Organization/iu);
});

it("separa filas, Memberships e Organizations sem incluir cursor", () => {
  const mine = leadQueryKeys.myActions("org-a", {
    state: "overdue",
    limit: 25,
  });
  const another = leadQueryKeys.myActions("org-a", {
    state: "overdue",
    responsibleMembershipId: "00000000-0000-4000-8000-000000000011",
    limit: 25,
  });
  expect(mine).not.toEqual(another);
  expect(mine).not.toEqual(
    leadQueryKeys.unassignedQueue("org-a", {
      status: "active",
      limit: 25,
    }),
  );
  expect(mine).not.toEqual(
    leadQueryKeys.myActions("org-b", { state: "overdue", limit: 25 }),
  );
  expect(JSON.stringify(mine)).not.toContain("cursor");
});

it("canonicaliza filtros e não colide colunas ou tenants", () => {
  const first = leadQueryKeys.kanban("org-a", {
    source: "manual",
    limit: 20,
    q: " Lead ",
  });
  const equivalent = leadQueryKeys.kanban("org-a", {
    q: "Lead",
    limit: 20,
    source: "manual",
  });
  expect(first).toEqual(equivalent);
  expect(leadQueryKeys.kanbanColumn("org-a", { limit: 20 }, "new")).not.toEqual(
    leadQueryKeys.kanbanColumn("org-a", { limit: 20 }, "proposal"),
  );
  expect(leadQueryKeys.kanban("org-a", { limit: 20 })).not.toEqual(
    leadQueryKeys.kanban("org-b", { limit: 20 }),
  );
  expect(() => leadQueryKeys.kanbans("")).toThrow(/Organization/iu);
});

it("distingue agregado Kanban de continuações por coluna", () => {
  const aggregate = leadQueryKeys.kanban("org-a", { q: "Lead", limit: 20 });
  const column = leadQueryKeys.kanbanColumn(
    "org-a",
    { q: "Lead", limit: 20 },
    "new",
  );
  expect(isLeadKanbanAggregateKey("org-a", aggregate)).toBe(true);
  expect(isLeadKanbanAggregateKey("org-a", column)).toBe(false);
  expect(isLeadKanbanAggregateKey("org-b", aggregate)).toBe(false);
});
