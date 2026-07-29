import type {
  LeadKanbanFilters,
  LeadMyActionsFilters,
  LeadReturnReviewFilters,
  LeadStage,
  LeadUnassignedFilters,
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

export function leadMyActionsQueryOptions(
  api: LeadApi,
  organizationId: string,
  filters: LeadMyActionsFilters,
) {
  return {
    queryKey: leadQueryKeys.myActions(organizationId, filters),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => api.myActions(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Awaited<ReturnType<LeadApi["myActions"]>>) =>
      lastPage.page.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  };
}

export function leadUnassignedQueryOptions(
  api: LeadApi,
  organizationId: string,
  filters: LeadUnassignedFilters,
) {
  return {
    queryKey: leadQueryKeys.unassignedQueue(organizationId, filters),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => api.unassigned(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Awaited<ReturnType<LeadApi["unassigned"]>>) =>
      lastPage.page.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  };
}

export function leadReturnReviewsQueryOptions(
  api: LeadApi,
  organizationId: string,
  filters: LeadReturnReviewFilters,
) {
  return {
    queryKey: leadQueryKeys.returnReviewQueue(organizationId, filters),
    queryFn: ({
      pageParam,
      signal,
    }: {
      pageParam: string | undefined;
      signal: AbortSignal;
    }) => api.returnReviews(filters, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (
      lastPage: Awaited<ReturnType<LeadApi["returnReviews"]>>,
    ) => lastPage.page.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  };
}
