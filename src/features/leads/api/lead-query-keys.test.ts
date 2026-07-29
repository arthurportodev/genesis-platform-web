import {
  defaultLeadFilters,
  defaultLeadKanbanFilters,
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
  ]) {
    expect(key.slice(0, 3)).toEqual(["organization", organizationId, "leads"]);
  }
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
