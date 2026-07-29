import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import type {
  LeadReturnReviewItem,
  LeadWorkItem,
  Member,
} from "@/features/leads/api/lead-contracts";
import {
  formatDateTime,
  responsibleLabel,
  stageLabels,
  temporalLabels,
} from "@/features/leads/api/lead-labels";
import { leadWorkCapabilities } from "@/features/leads/api/lead-capabilities";
import { LeadQuickActionMenu } from "@/features/leads/components/LeadQuickActionMenu";
import type { LeadWorkMutationController } from "@/features/leads/hooks/use-lead-work-mutations";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/Badge";
import { buttonVariants } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useActiveOrganization } from "@/shared/organization/active-organization";

const actionTypeLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  call: "Ligação",
  meeting: "Reunião",
  diagnosis: "Diagnóstico",
  send_proposal: "Enviar proposta",
  follow_up: "Follow-up",
  internal_task: "Tarefa interna",
};

export function LeadWorkQueueItem({
  variant,
  item,
  review,
  members,
  index,
  controller,
}: {
  variant: "my-actions" | "unassigned" | "return-reviews";
  item: LeadWorkItem;
  review?: LeadReturnReviewItem;
  members: readonly Member[];
  index: number;
  controller: LeadWorkMutationController;
}) {
  const navigation = useLeadNavigationState();
  const organization = useActiveOrganization();
  const capabilities = leadWorkCapabilities(organization, variant, item);
  const busy = controller.busyLeadId === item.id;
  const titleId = `lead-work-${variant}-${item.id}`;
  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      data-lead-work-item={item.id}
      data-test-visible="true"
      tabIndex={-1}
      className="h-full p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="truncate font-semibold">
            {item.displayName}
          </h3>
          {item.companyName ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {item.companyName}
            </p>
          ) : null}
        </div>
        <Badge variant={item.status === "active" ? "info" : "neutral"}>
          {stageLabels[item.stage]}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {variant === "my-actions" && item.nextAction ? (
          <>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próxima ação
              </dt>
              <dd className="mt-1">
                {actionTypeLabels[item.nextAction.type] ?? item.nextAction.type}
              </dd>
              <dd className="mt-1 line-clamp-2 text-muted-foreground">
                {item.nextAction.description}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vencimento
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden="true" />
                {formatDateTime(item.nextAction.dueAt)} ·{" "}
                {temporalLabels[item.temporalState]}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Responsável</dt>
              <dd className="flex items-center gap-2 text-muted-foreground">
                <UserRound className="size-4" aria-hidden="true" />
                {responsibleLabel(
                  item.responsibleMembershipId,
                  organization.membershipId,
                  members,
                )}
              </dd>
            </div>
          </>
        ) : null}

        {variant === "unassigned" ? (
          <>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Origem
              </dt>
              <dd className="mt-1 capitalize">
                {item.source.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Última entrada
              </dt>
              <dd className="mt-1">{formatDateTime(item.lastEntryAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próxima ação
              </dt>
              <dd className="mt-1 text-muted-foreground">
                {item.nextAction
                  ? `${actionTypeLabels[item.nextAction.type] ?? item.nextAction.type} · ${formatDateTime(item.nextAction.dueAt)}`
                  : "Sem próxima ação"}
              </dd>
            </div>
          </>
        ) : null}

        {variant === "return-reviews" && review ? (
          <>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entradas recebidas
              </dt>
              <dd className="mt-1">{review.review.entryCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Origem
              </dt>
              <dd className="mt-1 capitalize">
                {item.source.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Primeira entrada
              </dt>
              <dd className="mt-1">
                {formatDateTime(review.review.firstEntry.receivedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Última entrada
              </dt>
              <dd className="mt-1">
                {formatDateTime(review.review.latestEntry.receivedAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="sr-only">Revisão atualizada</dt>
              <dd className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" />
                Aberta em {formatDateTime(review.review.openedAt)} · atualizada
                em {formatDateTime(review.review.updatedAt)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Link
          to="/app/leads/$leadId"
          params={{ leadId: item.id }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "min-h-11",
          )}
          onClick={() =>
            navigation.markDetailOrigin("follow-up", globalThis.scrollY)
          }
        >
          Abrir detalhe
        </Link>
        {capabilities.canManageNextAction ||
        capabilities.canAssign ||
        capabilities.canDismissReturn ? (
          <LeadQuickActionMenu
            variant={variant}
            item={item}
            review={review}
            members={members}
            index={index}
            controller={controller}
          />
        ) : null}
      </div>
    </Card>
  );
}
