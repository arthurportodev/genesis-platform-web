import { useDroppable, type UseDroppableInput } from "@dnd-kit/react";
import { LoaderCircle, RefreshCw } from "lucide-react";

import type {
  LeadListItem,
  Member,
  PipelineStage,
} from "@/features/leads/api/lead-contracts";
import { LeadKanbanCard } from "@/features/leads/components/LeadKanbanCard";
import type { LeadKanbanViewColumn } from "@/features/leads/model/lead-kanban";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import { cn } from "@/shared/lib/cn";
import type { ActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";

function draggedLeadStage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || value.kind !== "pipeline-lead") return null;
  if (!("lead" in value) || typeof value.lead !== "object") return null;
  if (value.lead === null || !("pipelineStageId" in value.lead)) return null;
  return typeof value.lead.pipelineStageId === "string"
    ? value.lead.pipelineStageId
    : null;
}

export function LeadKanbanColumn({
  column,
  pipelineId,
  stages,
  instance,
  members,
  organization,
  busyLeadId,
  movesDisabled,
  isFetchingMore,
  continuationError,
  onLoadMore,
  onRetry,
  onMove,
}: {
  column: LeadKanbanViewColumn;
  pipelineId: string;
  stages: readonly Pick<PipelineStage, "id" | "name" | "position">[];
  instance: "mobile" | "desktop";
  members: readonly Member[];
  organization: ActiveOrganization;
  busyLeadId: string | null;
  movesDisabled: boolean;
  isFetchingMore: boolean;
  continuationError: Error | null;
  onLoadMore: () => void;
  onRetry: () => void;
  onMove: (
    lead: LeadListItem,
    targetStageId: string,
    targetStageName: string,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
}) {
  const headingId = `pipeline-column-${instance}-${column.stage.id}`;
  const droppableInput = {
    id: `pipeline-stage-${instance}-${column.stage.id}`,
    data: { kind: "pipeline-stage", pipelineId, stage: column.stage },
    disabled: instance !== "desktop" || movesDisabled,
    accept: (source) => {
      const sourceStage = draggedLeadStage(source.data);
      return sourceStage !== null && sourceStage !== column.stage.id;
    },
  } as UseDroppableInput<{
    kind: "pipeline-stage";
    pipelineId: string;
    stage: Pick<PipelineStage, "id" | "name" | "position">;
  }>;
  const { ref: droppableRef, isDropTarget } = useDroppable(droppableInput);
  return (
    <section
      ref={droppableRef}
      className={cn(
        "flex min-h-[24rem] w-full flex-col rounded-xl border border-border/60 bg-muted/15 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none md:w-[19rem] md:min-w-[19rem]",
        isDropTarget && "border-primary/70 bg-primary/5 ring-2 ring-primary/40",
      )}
      aria-labelledby={headingId}
      data-drop-target={isDropTarget || undefined}
    >
      <header className="sticky top-0 z-10 rounded-t-xl border-b border-border/60 bg-background/95 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id={headingId}
            data-pipeline-column-heading={column.stage.id}
            tabIndex={-1}
            className="font-semibold outline-none"
          >
            {column.stage.name}
          </h2>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {column.total}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {formatBrlMinorUnits(column.expectedValueTotalMinor)}
        </p>
        {column.withoutExpectedValue > 0 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {column.withoutExpectedValue} sem valor informado
          </p>
        ) : null}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 md:max-h-[calc(100vh-22rem)]">
        {column.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-5 text-center text-sm text-muted-foreground">
            Nenhuma oportunidade nesta etapa
          </p>
        ) : (
          column.items.map((lead) => (
            <LeadKanbanCard
              key={lead.id}
              lead={lead}
              instance={instance}
              members={members}
              organization={organization}
              stages={stages}
              processing={busyLeadId === lead.id}
              movesDisabled={movesDisabled}
              onMove={onMove}
            />
          ))
        )}
        {continuationError ? (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
            role="alert"
          >
            <p>Não foi possível carregar mais Leads desta etapa.</p>
            <Button
              className="mt-2 min-h-11"
              variant="secondary"
              onClick={onRetry}
            >
              <RefreshCw className="size-4" aria-hidden="true" /> Tentar
              novamente
            </Button>
          </div>
        ) : null}
      </div>
      {column.nextCursor ? (
        <footer className="border-t border-border/60 bg-background/80 p-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {column.items.length} de {column.total} carregados
          </p>
          <Button
            className="min-h-11 w-full"
            variant="secondary"
            disabled={isFetchingMore}
            onClick={onLoadMore}
          >
            {isFetchingMore ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isFetchingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </footer>
      ) : null}
    </section>
  );
}
