import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LeadKanban } from "@/features/leads/components/LeadKanban";
import { LeadMoveFeedback } from "@/features/leads/components/LeadMoveFeedback";
import { PipelineConfiguration } from "@/features/leads/components/PipelineConfiguration";
import { useLeadKanbanBoard } from "@/features/leads/hooks/use-lead-kanban";
import {
  useLeadAssigneesQuery,
  usePipelinesQuery,
} from "@/features/leads/hooks/use-lead-queries";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { useLeadPipelineState } from "@/features/leads/model/lead-pipeline-state";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import { toAppError } from "@/shared/api/errors";
import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/shared/lib/cn";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button, buttonVariants } from "@/shared/ui/Button";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

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
  const search = useSearch({ from: "/app/pipeline" });
  const navigate = useNavigate({ from: "/app/pipeline" });
  const state = useLeadPipelineState();
  const navigation = useLeadNavigationState();
  const [creationNotice] = useState(navigation.creationNotice);
  const pipelines = usePipelinesQuery();
  const selectedPipeline = useMemo(() => {
    if (!pipelines.data) return undefined;
    return (
      pipelines.data.find((pipeline) => pipeline.id === search.pipelineId) ??
      pipelines.data.find((pipeline) => pipeline.isDefault) ??
      pipelines.data[0]
    );
  }, [pipelines.data, search.pipelineId]);
  const board = useLeadKanbanBoard(
    selectedPipeline?.id ?? "",
    Boolean(selectedPipeline),
  );
  const move = state.move;
  const canConfigure =
    organization.role === "owner" || organization.role === "admin";
  const assignees = useLeadAssigneesQuery(canConfigure);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );

  useEffect(() => {
    if (creationNotice) navigation.clearCreationNotice();
  }, [creationNotice, navigation]);
  useEffect(() => {
    if (
      search.pipelineId &&
      pipelines.data &&
      !pipelines.data.some((pipeline) => pipeline.id === search.pipelineId) &&
      selectedPipeline
    ) {
      void navigate({
        search: { pipelineId: selectedPipeline.id },
        replace: true,
      });
    }
  }, [navigate, pipelines.data, search.pipelineId, selectedPipeline]);

  if (pipelines.isPending)
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendas"
          title="Pipeline"
          description="Acompanhe oportunidades por etapa e mova cada Lead com confirmação do servidor."
        />
        <OperationalState
          kind="loading"
          title="Carregando Pipelines"
          description="Consultando os Pipelines da Organization ativa."
        />
      </div>
    );
  if (pipelines.isError || !selectedPipeline)
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendas"
          title="Pipeline"
          description="Acompanhe oportunidades por etapa e mova cada Lead com confirmação do servidor."
        />
        <OperationalState
          kind="error"
          title="Pipelines indisponíveis"
          description={pipelineErrorMessage(pipelines.error)}
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendas"
        title="Pipeline"
        description="Acompanhe oportunidades por etapa e mova cada Lead com confirmação do servidor."
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              to="/app/leads/new"
              search={{ from: "pipeline", pipelineId: selectedPipeline.id }}
              className={cn(buttonVariants(), "min-h-11")}
            >
              <Plus className="size-4" aria-hidden="true" /> Nova oportunidade
            </Link>
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
          </div>
        }
      />

      <div className="max-w-md space-y-2">
        <Label htmlFor="pipeline-selector">Pipeline atual</Label>
        <Select
          id="pipeline-selector"
          className="min-h-11"
          value={selectedPipeline.id}
          onChange={(event) => {
            state.setMobileStage(null);
            void navigate({ search: { pipelineId: event.target.value } });
          }}
        >
          {pipelines.data.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
              {pipeline.isDefault ? " · padrão" : ""}
            </option>
          ))}
        </Select>
      </div>

      {creationNotice && creationNotice !== "lead-submission-received" ? (
        <p
          className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {creationNotice === "lead-created"
            ? "Oportunidade criada."
            : creationNotice === "lead-existing-entry-recorded"
              ? "Nova entrada registrada no Lead existente. Use o detalhe para adicioná-lo ao Pipeline, se necessário."
              : "Resultado confirmado."}
        </p>
      ) : null}

      <LeadMoveFeedback
        feedback={move.feedback}
        onRetry={() => void move.retry()}
        onAbandon={() => void move.abandon()}
        onClose={() => move.clearFeedback()}
      />

      {board.initial.isPending ? (
        <OperationalState
          kind="loading"
          compact
          title="Carregando Pipeline"
          description={`Consultando as etapas de ${selectedPipeline.name}.`}
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
            pipelineId={selectedPipeline.id}
            stages={board.stages}
            columns={board.columns}
            members={members}
            organization={organization}
            busyLeadId={move.busyLeadId}
            movesDisabled={move.phase !== "idle"}
            mobileStage={state.mobileStage}
            onMobileStageChange={state.setMobileStage}
            onMove={(lead, targetStageId, targetStageName, focusTarget) =>
              move.confirmMove(
                lead,
                targetStageId,
                targetStageName,
                selectedPipeline.id,
                focusTarget,
              )
            }
          />
        </div>
      )}

      {canConfigure ? (
        <PipelineConfiguration
          key={`${selectedPipeline.id}:${selectedPipeline.revision}`}
          pipeline={selectedPipeline}
          onPipelineCreated={(pipelineId) => {
            state.setMobileStage(null);
            void navigate({ search: { pipelineId } });
          }}
        />
      ) : null}
    </div>
  );
}
