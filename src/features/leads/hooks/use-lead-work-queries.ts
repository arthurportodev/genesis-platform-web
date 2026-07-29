import { useInfiniteQuery } from "@tanstack/react-query";

import type {
  LeadMyActionsFilters,
  LeadReturnReviewFilters,
  LeadUnassignedFilters,
} from "@/features/leads/api/lead-contracts";
import {
  leadMyActionsQueryOptions,
  leadReturnReviewsQueryOptions,
  leadUnassignedQueryOptions,
} from "@/features/leads/api/lead-query-options";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export function useLeadMyActionsQuery(
  filters: LeadMyActionsFilters,
  enabled = true,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    ...leadMyActionsQueryOptions(api, organization.id, filters),
    enabled,
  });
}

export function useLeadUnassignedQuery(
  filters: LeadUnassignedFilters,
  enabled = true,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    ...leadUnassignedQueryOptions(api, organization.id, filters),
    enabled,
  });
}

export function useLeadReturnReviewsQuery(
  filters: LeadReturnReviewFilters,
  enabled = true,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    ...leadReturnReviewsQueryOptions(api, organization.id, filters),
    enabled,
  });
}
