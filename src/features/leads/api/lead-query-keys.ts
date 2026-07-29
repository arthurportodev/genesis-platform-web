import type {
  LeadKanbanFilters,
  LeadListFilters,
  LeadMyActionsFilters,
  LeadReturnReviewFilters,
  LeadStage,
  LeadUnassignedFilters,
} from "@/features/leads/api/lead-contracts";
import {
  canonicalLeadKanbanFilters,
  canonicalLeadMyActionsFilters,
  canonicalLeadReturnReviewFilters,
  canonicalLeadUnassignedFilters,
} from "@/features/leads/api/lead-filters";
import type { CanonicalMetricsPeriod } from "@/features/leads/model/lead-metrics-period";

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
  work: (organizationId: string) => [...root(organizationId), "work"] as const,
  myActionsRoot: (organizationId: string) =>
    [...root(organizationId), "work", "my-actions"] as const,
  myActions: (organizationId: string, filters: LeadMyActionsFilters) =>
    [
      ...root(organizationId),
      "work",
      "my-actions",
      canonicalLeadMyActionsFilters(filters),
    ] as const,
  unassignedQueues: (organizationId: string) =>
    [...root(organizationId), "work", "unassigned"] as const,
  unassignedQueue: (organizationId: string, filters: LeadUnassignedFilters) =>
    [
      ...root(organizationId),
      "work",
      "unassigned",
      canonicalLeadUnassignedFilters(filters),
    ] as const,
  returnReviewQueues: (organizationId: string) =>
    [...root(organizationId), "work", "return-reviews"] as const,
  returnReviewQueue: (
    organizationId: string,
    filters: LeadReturnReviewFilters,
  ) =>
    [
      ...root(organizationId),
      "work",
      "return-reviews",
      canonicalLeadReturnReviewFilters(filters),
    ] as const,
  metricsRoot: (organizationId: string) =>
    [...root(organizationId), "metrics"] as const,
  metrics: (organizationId: string, period: CanonicalMetricsPeriod) =>
    [...root(organizationId), "metrics", period] as const,
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
