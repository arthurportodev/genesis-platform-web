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
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { cn } from "@/shared/lib/cn";
import type { ActiveOrganization } from "@/shared/organization/active-organization";
import { Badge } from "@/shared/ui/Badge";
import { buttonVariants } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";

function nextActionTypeLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function LeadKanbanCard({
  lead,
  instance,
  members,
  organization,
  processing,
  movesDisabled,
  onMove,
}: {
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
}) {
  const navigation = useLeadNavigationState();
  const capabilities = leadCapabilities(organization, {
    status: lead.status,
    responsibleMembershipId: lead.responsibleMembershipId,
    returnReviewPending: lead.returnPending,
  });
  const titleId = `pipeline-lead-${instance}-${lead.id}`;
  return (
    <Card
      className={cn("p-4", processing && "border-primary/40 bg-muted/35")}
      role="article"
      aria-labelledby={titleId}
      aria-busy={processing || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="truncate font-semibold">
            {lead.displayName}
          </h3>
          {lead.companyName ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {lead.companyName}
            </p>
          ) : null}
        </div>
        {processing ? <Badge variant="info">Processando</Badge> : null}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <UserRound
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
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
          <CalendarClock
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="sr-only">Próxima ação</dt>
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
                temporalLabels.none
              )}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock3
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <dt className="sr-only">Última atualização</dt>
            <dd className="text-muted-foreground">
              Atualizado em {formatDateTime(lead.updatedAt)}
            </dd>
          </div>
        </div>
      </dl>

      {lead.returnPending ? (
        <Badge className="mt-4" variant="warning">
          Retorno pendente
        </Badge>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link
          to="/app/leads/$leadId"
          params={{ leadId: lead.id }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "min-h-11",
          )}
          onClick={() => navigation.markDetailOrigin("pipeline")}
        >
          Abrir detalhe
        </Link>
        {capabilities.canMove ? (
          <LeadMoveControl
            lead={lead}
            disabled={processing || movesDisabled}
            onConfirm={(targetStage, focusTarget) =>
              onMove(lead, targetStage, focusTarget)
            }
          />
        ) : null}
      </div>
    </Card>
  );
}
