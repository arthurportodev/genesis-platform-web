import { useDraggable } from "@dnd-kit/react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import type {
  LeadListItem,
  LeadStage,
  Member,
} from "@/features/leads/api/lead-contracts";
import { leadCapabilities } from "@/features/leads/api/lead-capabilities";
import {
  formatDateTime,
  responsibleLabel,
  temporalLabels,
} from "@/features/leads/api/lead-labels";
import { LeadMoveControl } from "@/features/leads/components/LeadMoveControl";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { cn } from "@/shared/lib/cn";
import type { ActiveOrganization } from "@/shared/organization/active-organization";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";

function nextActionTypeLabel(value: string): string {
  return value.replaceAll("_", " ");
}

type LeadKanbanCardProps = {
  lead: LeadListItem;
  instance: "mobile" | "desktop";
  members: readonly Member[];
  organization: ActiveOrganization;
  processing: boolean;
  movesDisabled: boolean;
  onMove: (
    lead: LeadListItem,
    targetStage: LeadStage,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
};

type LeadKanbanCardBodyProps = LeadKanbanCardProps & {
  canMove: boolean;
  isDragging?: boolean;
  titleId: string;
};

function LeadKanbanCardBody({
  lead,
  members,
  organization,
  processing,
  movesDisabled,
  onMove,
  canMove,
  isDragging = false,
  titleId,
}: LeadKanbanCardBodyProps) {
  const navigation = useLeadNavigationState();

  return (
    <Card
      className={cn(
        "border-border bg-surface p-3 shadow-sm transition-[transform,box-shadow] duration-150 motion-reduce:transition-none",
        processing && "border-primary/40 bg-muted/35",
        isDragging && "scale-[1.02] shadow-xl",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate font-semibold">
            {lead.displayName}
          </h3>
          {lead.companyName ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {lead.companyName}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <div className="pt-2 text-right">
            {lead.expectedValueMinor === null ? (
              <p className="max-w-24 text-xs font-medium text-muted-foreground">
                Valor não informado
              </p>
            ) : (
              <p className="font-semibold tabular-nums">
                {formatBrlMinorUnits(lead.expectedValueMinor)}
              </p>
            )}
            {processing ? (
              <Badge className="mt-1.5" variant="info">
                Processando
              </Badge>
            ) : null}
          </div>
          <LeadMoveControl
            lead={lead}
            canMove={canMove}
            moveDisabled={processing || movesDisabled}
            detailAction={
              <Link
                to="/app/leads/$leadId"
                params={{ leadId: lead.id }}
                onClick={() => navigation.markDetailOrigin("pipeline")}
              >
                Abrir detalhe
              </Link>
            }
            onConfirm={(targetStage, focusTarget) =>
              onMove(lead, targetStage, focusTarget)
            }
          />
        </div>
      </div>

      <dl className="mt-3 space-y-2">
        <div className="flex items-start gap-2 rounded-lg bg-muted/35 p-2.5 text-sm">
          <CalendarClock
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Próxima ação
            </dt>
            <dd>
              {lead.nextAction ? (
                <>
                  <span className="block capitalize">
                    {nextActionTypeLabel(lead.nextAction.type)} ·{" "}
                    {temporalLabels[lead.temporalState]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(lead.nextAction.dueAt)}
                  </span>
                </>
              ) : (
                "Sem próxima ação"
              )}
            </dd>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <dt className="sr-only">Responsável</dt>
              <dd>
                {responsibleLabel(
                  lead.responsibleMembershipId,
                  organization.membershipId,
                  members,
                )}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <dt className="sr-only">Última atualização</dt>
              <dd>Atualizado em {formatDateTime(lead.updatedAt)}</dd>
            </div>
          </div>
        </div>
      </dl>

      {lead.returnPending ? (
        <Badge className="mt-3" variant="warning">
          Retorno pendente
        </Badge>
      ) : null}
    </Card>
  );
}

function DraggableLeadKanbanCard({
  lead,
  instance,
  processing,
  movesDisabled,
  ...props
}: LeadKanbanCardProps & { canMove: boolean; titleId: string }) {
  const interactionDisabled = processing || movesDisabled;
  const {
    ref: draggableRef,
    handleRef,
    isDragging,
    isDropping,
  } = useDraggable({
    id: `pipeline-lead-${instance}-${lead.id}`,
    data: { kind: "pipeline-lead", lead, canMove: true },
    sensors: interactionDisabled ? [] : undefined,
  });

  return (
    <div
      ref={(element) => {
        draggableRef(element);
        handleRef(element);
      }}
      role="article"
      aria-labelledby={props.titleId}
      aria-busy={processing || undefined}
      tabIndex={interactionDisabled ? undefined : 0}
      className={cn(
        "rounded-xl outline-none transition-opacity duration-150 motion-reduce:transition-none",
        !interactionDisabled &&
          "cursor-grab focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isDragging && "z-20 cursor-grabbing opacity-90",
        isDropping && "cursor-grabbing",
      )}
      data-draggable={interactionDisabled ? undefined : "true"}
      data-dragging={isDragging || undefined}
    >
      <LeadKanbanCardBody
        {...props}
        lead={lead}
        instance={instance}
        processing={processing}
        movesDisabled={movesDisabled}
        isDragging={isDragging}
      />
    </div>
  );
}

export function LeadKanbanCard(props: LeadKanbanCardProps) {
  const capabilities = leadCapabilities(props.organization, {
    status: props.lead.status,
    responsibleMembershipId: props.lead.responsibleMembershipId,
    returnReviewPending: props.lead.returnPending,
  });
  const titleId = `pipeline-lead-${props.instance}-${props.lead.id}`;

  if (props.instance === "desktop" && capabilities.canMove) {
    return (
      <DraggableLeadKanbanCard
        {...props}
        canMove={capabilities.canMove}
        titleId={titleId}
      />
    );
  }

  return (
    <div
      role="article"
      aria-labelledby={titleId}
      aria-busy={props.processing || undefined}
    >
      <LeadKanbanCardBody
        {...props}
        canMove={capabilities.canMove}
        titleId={titleId}
      />
    </div>
  );
}
