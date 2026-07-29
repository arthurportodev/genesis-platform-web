import type { LeadListFilters } from "@/features/leads/api/lead-contracts";

export const leadQueryKeys = {
  root: (organizationId: string) =>
    ["organization", organizationId, "leads"] as const,
  inbox: (organizationId: string, filters: LeadListFilters, cursor?: string) =>
    [
      "organization",
      organizationId,
      "leads",
      "inbox",
      filters,
      cursor ?? null,
    ] as const,
  detail: (organizationId: string, leadId: string) =>
    ["organization", organizationId, "leads", "detail", leadId] as const,
  timeline: (organizationId: string, leadId: string) =>
    ["organization", organizationId, "leads", "timeline", leadId] as const,
  nextAction: (organizationId: string, leadId: string) =>
    ["organization", organizationId, "leads", "next-action", leadId] as const,
  cycles: (organizationId: string, leadId: string) =>
    ["organization", organizationId, "leads", "cycles", leadId] as const,
  assignees: (organizationId: string) =>
    ["organization", organizationId, "leads", "assignees"] as const,
};
