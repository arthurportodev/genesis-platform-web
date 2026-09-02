import { LoaderCircle, RefreshCw } from "lucide-react";

import type {
  LeadListItem,
  LeadStage,
  Member,
} from "@/features/leads/api/lead-contracts";
import { stageLabels } from "@/features/leads/api/lead-labels";
import { LeadKanbanCard } from "@/features/leads/components/LeadKanbanCard";
import type { LeadKanbanViewColumn } from "@/features/leads/model/lead-kanban";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import type { ActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";

export function LeadKanbanColumn({
  column,
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
    targetStage: LeadStage,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
}) {
  const headingId = `pipeline-column-${instance}-${column.stage}`;
  return (
    <section
      className="flex min-h-[24rem] w-full flex-col rounded-xl border border-border/60 bg-muted/15 md:w-[19rem] md:min-w-[19rem]"
      aria-labelledby={headingId}
    >
      <header className="sticky top-0 z-10 rounded-t-xl border-b border-border/60 bg-background/95 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id={headingId}
            data-pipeline-column-heading={column.stage}
            tabIndex={-1}
            className="font-semibold outline-none"
          >
            {stageLabels[column.stage]}
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
