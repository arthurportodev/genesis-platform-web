import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
  type LeadKanbanFilters,
  type LeadKanbanResponse,
  type LeadStage,
} from "@/features/leads/api/lead-contracts";
import {
  leadKanbanColumnQueryOptions,
  leadKanbanQueryOptions,
} from "@/features/leads/api/lead-query-options";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import {
  composeLeadKanbanColumns,
  composeLeadKanbanSummary,
  type LeadKanbanViewColumn,
} from "@/features/leads/model/lead-kanban";
import { useActiveOrganization } from "@/shared/organization/active-organization";

interface LeadKanbanColumnState {
  column: LeadKanbanViewColumn;
  isFetchingMore: boolean;
  continuationError: Error | null;
  fetchMore: () => Promise<void>;
  retry: () => Promise<void>;
}

function initialColumnResponse(
  response: LeadKanbanResponse | undefined,
  stage: LeadStage,
): LeadKanbanResponse | undefined {
  const column = response?.columns.find((item) => item.stage === stage);
  return column && response
    ? {
        asOf: response.asOf,
        currency: response.currency,
        expectedValueTotalMinor: response.expectedValueTotalMinor,
        withoutExpectedValue: response.withoutExpectedValue,
        columns: [column],
      }
    : undefined;
}

function useLeadKanbanColumn(
  filters: LeadKanbanFilters,
  stage: LeadStage,
  aggregate: LeadKanbanResponse | undefined,
  initialUpdatedAt: number,
  enabled: boolean,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  const queryClient = useQueryClient();
  const options = leadKanbanColumnQueryOptions(
    api,
    organization.id,
    filters,
    stage,
  );
  const initial = useMemo(
    () => initialColumnResponse(aggregate, stage),
    [aggregate, stage],
  );
  const initialData:
    InfiniteData<LeadKanbanResponse, string | undefined> | undefined = initial
    ? { pages: [initial], pageParams: [undefined] }
    : undefined;
  const query = useInfiniteQuery({
    ...options,
    enabled: enabled && initial !== undefined,
    initialData,
    initialDataUpdatedAt: initial ? initialUpdatedAt : undefined,
  });

  useEffect(() => {
    if (!initial || initialUpdatedAt === 0) return;
    queryClient.setQueryData<
      InfiniteData<LeadKanbanResponse, string | undefined>
    >(
      leadQueryKeys.kanbanColumn(organization.id, filters, stage),
      { pages: [initial], pageParams: [undefined] },
      { updatedAt: initialUpdatedAt },
    );
  }, [filters, initial, initialUpdatedAt, organization.id, queryClient, stage]);

  return query;
}

export function useLeadKanbanBoard(filters: LeadKanbanFilters, enabled = true) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  const initial = useQuery({
    ...leadKanbanQueryOptions(api, organization.id, filters),
    enabled,
  });
  const initialUpdatedAt = initial.dataUpdatedAt;
  const newColumn = useLeadKanbanColumn(
    filters,
    "new",
    initial.data,
    initialUpdatedAt,
    enabled,
  );
  const qualificationColumn = useLeadKanbanColumn(
    filters,
    "qualification",
    initial.data,
    initialUpdatedAt,
    enabled,
  );
  const diagnosisColumn = useLeadKanbanColumn(
    filters,
    "diagnosis",
    initial.data,
    initialUpdatedAt,
    enabled,
  );
  const proposalColumn = useLeadKanbanColumn(
    filters,
    "proposal",
    initial.data,
    initialUpdatedAt,
    enabled,
  );
  const negotiationColumn = useLeadKanbanColumn(
    filters,
    "negotiation",
    initial.data,
    initialUpdatedAt,
    enabled,
  );
  const queries = useMemo(
    () => ({
      new: newColumn,
      qualification: qualificationColumn,
      diagnosis: diagnosisColumn,
      proposal: proposalColumn,
      negotiation: negotiationColumn,
    }),
    [
      diagnosisColumn,
      negotiationColumn,
      newColumn,
      proposalColumn,
      qualificationColumn,
    ],
  );
  const columns = useMemo(() => {
    const pagesByStage: Record<LeadStage, readonly LeadKanbanResponse[]> = {
      new: queries.new.data?.pages ?? [],
      qualification: queries.qualification.data?.pages ?? [],
      diagnosis: queries.diagnosis.data?.pages ?? [],
      proposal: queries.proposal.data?.pages ?? [],
      negotiation: queries.negotiation.data?.pages ?? [],
    };
    return composeLeadKanbanColumns(pagesByStage);
  }, [queries]);
  const summary = useMemo(
    () => (initial.data ? composeLeadKanbanSummary(initial.data) : null),
    [initial.data],
  );

  const columnStates = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => {
          const query = queries[column.stage];
          const fetchMore = async () => {
            await query.fetchNextPage();
          };
          return [
            column.stage,
            {
              column,
              isFetchingMore: query.isFetchingNextPage,
              continuationError:
                query.isFetchNextPageError && query.error ? query.error : null,
              fetchMore,
              retry: fetchMore,
            } satisfies LeadKanbanColumnState,
          ];
        }),
      ) as Record<LeadStage, LeadKanbanColumnState>,
    [columns, queries],
  );

  return {
    initial,
    summary,
    columns: columnStates,
    isFetching: initial.isFetching,
    refresh: async () => {
      await initial.refetch();
    },
  };
}
