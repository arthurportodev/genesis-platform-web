import type {
  LeadKanbanFilters,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import { createLeadApi } from "@/features/leads/api/lead-api";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";

type LeadApi = ReturnType<typeof createLeadApi>;

export function leadDetailQueryOptions(
  api: LeadApi,
  organizationId: string,
  leadId: string,
) {
  return {
    queryKey: leadQueryKeys.detail(organizationId, leadId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.detail(leadId, signal),
    staleTime: 15_000,
  };
}

export function leadKanbanQueryOptions(
  api: LeadApi,
  organizationId: string,
  filters: LeadKanbanFilters,
) {
  return {
    queryKey: leadQueryKeys.kanban(organizationId, filters),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.kanban(filters, {}, signal),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  };
}

export function leadKanbanColumnQueryOptions(
  api: LeadApi,
  organizationId: string,
  filters: LeadKanbanFilters,
  stage: LeadStage,
) {
  return {
    queryKey: leadQueryKeys.kanbanColumn(organizationId, filters, stage),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => api.kanban(filters, { stage, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Awaited<ReturnType<LeadApi["kanban"]>>) =>
      lastPage.columns[0]?.page.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  };
}
