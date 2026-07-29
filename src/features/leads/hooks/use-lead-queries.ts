import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { LeadListFilters } from "@/features/leads/api/lead-contracts";
import { createLeadApi } from "@/features/leads/api/lead-api";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useHttpClient } from "@/shared/api/http-context";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export function useLeadApi() {
  const http = useHttpClient();
  return useMemo(() => createLeadApi(http), [http]);
}

export function useLeadInboxQuery(
  filters: LeadListFilters,
  cursor?: string,
  enabled = true,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useQuery({
    queryKey: leadQueryKeys.inbox(organization.id, filters, cursor),
    queryFn: ({ signal }) => api.list(filters, cursor, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function useLeadDetailQuery(leadId: string) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useQuery({
    queryKey: leadQueryKeys.detail(organization.id, leadId),
    queryFn: ({ signal }) => api.detail(leadId, signal),
    staleTime: 15_000,
  });
}

export function useLeadTimelineQuery(leadId: string) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    queryKey: leadQueryKeys.timeline(organization.id, leadId),
    queryFn: ({ pageParam, signal }) => api.timeline(leadId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

export function useLeadNextActionQuery(leadId: string) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useQuery({
    queryKey: leadQueryKeys.nextAction(organization.id, leadId),
    queryFn: ({ signal }) => api.nextAction(leadId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useLeadCyclesQuery(leadId: string) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    queryKey: leadQueryKeys.cycles(organization.id, leadId),
    queryFn: ({ pageParam, signal }) => api.cycles(leadId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useLeadAssigneesQuery(enabled: boolean) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  return useInfiniteQuery({
    queryKey: leadQueryKeys.assignees(organization.id),
    queryFn: ({ pageParam, signal }) => api.members(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    staleTime: 60_000,
    enabled,
  });
}
