import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import type { LeadKanbanFilters as LeadKanbanFilterValues } from "@/features/leads/api/lead-contracts";
import {
  canonicalLeadKanbanFilters,
  leadSearchMessage,
  normalizedLeadSearch,
} from "@/features/leads/api/lead-filters";
import { LeadKanban } from "@/features/leads/components/LeadKanban";
import { LeadKanbanFilters } from "@/features/leads/components/LeadKanbanFilters";
import { LeadMoveFeedback } from "@/features/leads/components/LeadMoveFeedback";
import { useLeadKanbanBoard } from "@/features/leads/hooks/use-lead-kanban";
import { useLeadAssigneesQuery } from "@/features/leads/hooks/use-lead-queries";
import { useLeadPipelineState } from "@/features/leads/model/lead-pipeline-state";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import { toAppError } from "@/shared/api/errors";
import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";

function pipelineErrorMessage(error: unknown): string {
  const appError = toAppError(error);
  if (appError.kind === "forbidden")
    return "Seu acesso ao Pipeline desta Organization não está disponível.";
  if (appError.kind === "rate-limited")
    return "O Pipeline recebeu muitas consultas. Aguarde um instante e tente novamente.";
  if (appError.kind === "server")
    return "A leitura operacional está temporariamente indisponível.";
  return appError.message;
}

export function LeadPipelinePage() {
  const organization = useActiveOrganization();
  const state = useLeadPipelineState();
  const canUseDirectory =
    organization.role === "owner" || organization.role === "admin";
  const debouncedSearch = useDebouncedValue(state.search, 350);
  const searchCanQuery = leadSearchMessage(debouncedSearch) === null;
  const queryFilters = useMemo(
    () =>
      canonicalLeadKanbanFilters({
        ...state.filters,
        q: normalizedLeadSearch(debouncedSearch),
      }),
    [debouncedSearch, state.filters],
  );
  const board = useLeadKanbanBoard(queryFilters, searchCanQuery);
  const move = state.move;
  const assignees = useLeadAssigneesQuery(canUseDirectory);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );

  const changeFilters = (filters: LeadKanbanFilterValues) => {
    state.setFilters(canonicalLeadKanbanFilters(filters));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendas"
        title="Pipeline"
        description="Acompanhe Leads ativos por etapa e mova oportunidades com verificação de versão."
        action={
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={board.isFetching || move.phase !== "idle"}
            onClick={() => void board.refresh()}
          >
            <RefreshCw
              className={`size-4 ${board.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            Atualizar
          </Button>
        }
      />

      <LeadKanbanFilters
        search={state.search}
        filters={state.filters}
        members={members}
        canUseDirectory={canUseDirectory}
        hasMoreMembers={assignees.hasNextPage === true}
        loadingMoreMembers={assignees.isFetchingNextPage}
        onSearchChange={(value) => state.setSearch(value)}
        onFiltersChange={changeFilters}
        onLoadMoreMembers={() => void assignees.fetchNextPage()}
      />

      {canUseDirectory && assignees.isError ? (
        <p
          className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
          role="status"
        >
          O diretório de responsáveis está indisponível. O Pipeline continua
          disponível com rótulos protegidos.
        </p>
      ) : null}

      <LeadMoveFeedback
        feedback={move.feedback}
        onRetry={() => void move.retry()}
        onAbandon={() => void move.abandon()}
        onClose={() => move.clearFeedback()}
      />

      {!searchCanQuery ? (
        <OperationalState
          kind="empty"
          compact
          title="Complete a busca"
          description={
            leadSearchMessage(debouncedSearch) ?? "Revise a busca informada."
          }
        />
      ) : board.initial.isPending ? (
        <OperationalState
          kind="loading"
          compact
          title="Carregando Pipeline"
          description="Consultando as cinco etapas da Organization ativa."
        />
      ) : board.initial.isError ? (
        <section
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
          role="alert"
        >
          <h2 className="font-semibold">
            Não foi possível carregar o Pipeline
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {pipelineErrorMessage(board.initial.error)}
          </p>
          <Button
            className="mt-4 min-h-11"
            variant="secondary"
            onClick={() => void board.refresh()}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Tentar novamente
          </Button>
        </section>
      ) : (
        <div className="space-y-5">
          {board.summary ? (
            <section
              aria-label="Resumo do Pipeline"
              className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
            >
              <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <dt className="text-sm text-muted-foreground">
                    Oportunidades
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {board.summary.opportunityCount}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="text-sm text-muted-foreground">
                    Valor esperado
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatBrlMinorUnits(board.summary.expectedValueTotalMinor)}
                  </dd>
                </div>
                {board.summary.withoutExpectedValue > 0 ? (
                  <div className="text-sm text-muted-foreground">
                    <dt className="sr-only">Sem valor informado</dt>
                    <dd>
                      {board.summary.withoutExpectedValue} sem valor informado
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
          <LeadKanban
            columns={board.columns}
            members={members}
            organization={organization}
            busyLeadId={move.busyLeadId}
            movesDisabled={move.phase !== "idle"}
            mobileStage={state.mobileStage}
            onMobileStageChange={(stage) => state.setMobileStage(stage)}
            onMove={(lead, targetStage, focusTarget) =>
              move.confirmMove(lead, targetStage, focusTarget)
            }
          />
        </div>
      )}
    </div>
  );
}
