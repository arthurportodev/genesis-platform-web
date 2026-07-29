import type {
  LeadKanbanFilters,
  LeadListFilters,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import { canonicalLeadKanbanFilters } from "@/features/leads/api/lead-filters";

function root(organizationId: string) {
  if (!organizationId)
    throw new Error("Organization obrigatória na query key.");
  return ["organization", organizationId, "leads"] as const;
}

export const leadQueryKeys = {
  root,
  inboxes: (organizationId: string) =>
    [...root(organizationId), "inboxes"] as const,
  inbox: (organizationId: string, filters: LeadListFilters, cursor?: string) =>
    [...root(organizationId), "inboxes", filters, cursor ?? null] as const,
  kanbans: (organizationId: string) =>
    [...root(organizationId), "kanbans"] as const,
  kanban: (organizationId: string, filters: LeadKanbanFilters) =>
    [
      ...root(organizationId),
      "kanbans",
      canonicalLeadKanbanFilters(filters),
    ] as const,
  kanbanColumn: (
    organizationId: string,
    filters: LeadKanbanFilters,
    stage: LeadStage,
  ) =>
    [
      ...root(organizationId),
      "kanbans",
      canonicalLeadKanbanFilters(filters),
      "column",
      stage,
    ] as const,
  detail: (organizationId: string, leadId: string) =>
    [...root(organizationId), "detail", leadId] as const,
  timeline: (organizationId: string, leadId: string) =>
    [...root(organizationId), "timeline", leadId] as const,
  nextAction: (organizationId: string, leadId: string) =>
    [...root(organizationId), "next-action", leadId] as const,
  cycles: (organizationId: string, leadId: string) =>
    [...root(organizationId), "cycles", leadId] as const,
  assignees: (organizationId: string) =>
    [...root(organizationId), "assignees"] as const,
};

export function isLeadKanbanAggregateKey(
  organizationId: string,
  queryKey: readonly unknown[],
): boolean {
  const prefix = leadQueryKeys.kanbans(organizationId);
  return (
    queryKey.length === prefix.length + 1 &&
    prefix.every((part, index) => queryKey[index] === part)
  );
}
