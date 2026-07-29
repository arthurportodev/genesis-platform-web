import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, UserRound } from "lucide-react";

import type { LeadListItem, Member } from "@/features/leads/api/lead-contracts";
import {
  formatDateTime,
  responsibleLabel,
  stageLabels,
  statusLabels,
  temporalLabels,
} from "@/features/leads/api/lead-labels";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";

export function LeadInboxList({
  items,
  members,
  currentMembershipId,
}: {
  items: readonly LeadListItem[];
  members: readonly Member[];
  currentMembershipId: string;
}) {
  const navigation = useLeadNavigationState();
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Próxima ação</th>
              <th className="px-4 py-3">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((lead) => (
              <tr key={lead.id} className="transition hover:bg-muted/35">
                <td className="px-4 py-4">
                  <Link
                    to="/app/leads/$leadId"
                    params={{ leadId: lead.id }}
                    onClick={() => navigation.markDetailOrigin("inbox")}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {lead.displayName}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.companyName ?? lead.email ?? lead.primaryPhone}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Badge
                    variant={lead.status === "active" ? "info" : "neutral"}
                  >
                    {statusLabels[lead.status]} · {stageLabels[lead.stage]}
                  </Badge>
                </td>
                <td className="px-4 py-4">
                  {responsibleLabel(
                    lead.responsibleMembershipId,
                    currentMembershipId,
                    members,
                  )}
                </td>
                <td className="px-4 py-4">
                  <span className="block">
                    {temporalLabels[lead.temporalState]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lead.nextAction
                      ? formatDateTime(lead.nextAction.dueAt)
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    to="/app/leads/$leadId"
                    params={{ leadId: lead.id }}
                    onClick={() => navigation.markDetailOrigin("inbox")}
                    aria-label={`Abrir ${lead.displayName}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {items.map((lead) => (
          <Card key={lead.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to="/app/leads/$leadId"
                  params={{ leadId: lead.id }}
                  onClick={() => navigation.markDetailOrigin("inbox")}
                  className="font-semibold"
                >
                  {lead.displayName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lead.companyName ?? lead.primaryPhone}
                </p>
              </div>
              <Badge variant="info">{stageLabels[lead.stage]}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <UserRound className="size-4" aria-hidden="true" />
                {responsibleLabel(
                  lead.responsibleMembershipId,
                  currentMembershipId,
                  members,
                )}
              </span>
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4" aria-hidden="true" />
                {temporalLabels[lead.temporalState]}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
