import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { DynamicKanbanResponse } from "@/features/leads/api/lead-contracts";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import {
  composeDynamicKanbanColumn,
  composeLeadKanbanSummary,
} from "@/features/leads/model/lead-kanban";
import { useActiveOrganization } from "@/shared/organization/active-organization";

interface ContinuationState {
  pages: DynamicKanbanResponse[];
  loading: boolean;
  error: Error | null;
}

interface Continuations {
  sourceKey: string;
  byStage: Record<string, ContinuationState>;
}

export function useLeadKanbanBoard(pipelineId: string, enabled = true) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  const [continuations, setContinuations] = useState<Continuations>({
    sourceKey: "",
    byStage: {},
  });
  const initial = useQuery({
    queryKey: leadQueryKeys.pipelineKanban(organization.id, pipelineId),
    queryFn: ({ signal }) =>
      api.dynamicKanban(pipelineId, { limit: 20 }, signal),
    enabled: enabled && pipelineId !== "",
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const sourceKey = `${organization.id}:${pipelineId}:${initial.dataUpdatedAt}`;

  const stages = useMemo(
    () => initial.data?.columns.map(({ stage }) => stage) ?? [],
    [initial.data],
  );
  const columns = useMemo(
    () =>
      stages.map((stage) => {
        const continuation =
          continuations.sourceKey === sourceKey
            ? continuations.byStage[stage.id]
            : undefined;
        return {
          column: composeDynamicKanbanColumn(stage, [
            ...(initial.data ? [initial.data] : []),
            ...(continuation?.pages ?? []),
          ]),
          isFetchingMore: continuation?.loading ?? false,
          continuationError: continuation?.error ?? null,
          fetchMore: async () => {
            const current =
              continuations.sourceKey === sourceKey
                ? continuations.byStage[stage.id]
                : undefined;
            const pages = [
              ...(initial.data ? [initial.data] : []),
              ...(current?.pages ?? []),
            ];
            const cursor = pages
              .at(-1)
              ?.columns.find((column) => column.stage.id === stage.id)
              ?.page.nextCursor;
            if (!cursor || current?.loading) return;
            setContinuations((value) => {
              const byStage =
                value.sourceKey === sourceKey ? value.byStage : {};
              return {
                sourceKey,
                byStage: {
                  ...byStage,
                  [stage.id]: {
                    pages: byStage[stage.id]?.pages ?? [],
                    loading: true,
                    error: null,
                  },
                },
              };
            });
            try {
              const page = await api.dynamicKanban(pipelineId, {
                pipelineStageId: stage.id,
                cursor,
                limit: 20,
              });
              setContinuations((value) => {
                const byStage =
                  value.sourceKey === sourceKey ? value.byStage : {};
                return {
                  sourceKey,
                  byStage: {
                    ...byStage,
                    [stage.id]: {
                      pages: [...(byStage[stage.id]?.pages ?? []), page],
                      loading: false,
                      error: null,
                    },
                  },
                };
              });
            } catch (error) {
              setContinuations((value) => {
                const byStage =
                  value.sourceKey === sourceKey ? value.byStage : {};
                return {
                  sourceKey,
                  byStage: {
                    ...byStage,
                    [stage.id]: {
                      pages: byStage[stage.id]?.pages ?? [],
                      loading: false,
                      error:
                        error instanceof Error ? error : new Error("Falha"),
                    },
                  },
                };
              });
            }
          },
        };
      }),
    [api, continuations, initial.data, pipelineId, sourceKey, stages],
  );

  return {
    initial,
    summary: initial.data ? composeLeadKanbanSummary(initial.data) : null,
    stages,
    columns,
    isFetching: initial.isFetching,
    refresh: async () => {
      setContinuations({ sourceKey: "", byStage: {} });
      await initial.refetch();
    },
  };
}
