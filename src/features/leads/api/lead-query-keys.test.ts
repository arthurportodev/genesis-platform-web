import { defaultLeadFilters } from "@/features/leads/api/lead-filters";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";

it("mantém todas as chaves de Lead sob o tenant", () => {
  const organizationId = "00000000-0000-4000-8000-000000000001";
  for (const key of [
    leadQueryKeys.inbox(organizationId, defaultLeadFilters),
    leadQueryKeys.detail(organizationId, "lead"),
    leadQueryKeys.timeline(organizationId, "lead"),
    leadQueryKeys.nextAction(organizationId, "lead"),
    leadQueryKeys.cycles(organizationId, "lead"),
    leadQueryKeys.assignees(organizationId),
  ]) {
    expect(key.slice(0, 3)).toEqual(["organization", organizationId, "leads"]);
  }
});
