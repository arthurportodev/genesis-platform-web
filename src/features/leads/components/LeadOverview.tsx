import {
  Building2,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";

import type { LeadDetail, Member } from "@/features/leads/api/lead-contracts";
import {
  formatDateTime,
  responsibleLabel,
  stageLabels,
  statusLabels,
  temporalLabels,
} from "@/features/leads/api/lead-labels";
import {
  useLeadCyclesQuery,
  useLeadNextActionQuery,
} from "@/features/leads/hooks/use-lead-queries";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";

export function LeadOverview({
  lead,
  members,
  currentMembershipId,
}: {
  lead: LeadDetail;
  members: readonly Member[];
  currentMembershipId: string;
}) {
  const nextAction = useLeadNextActionQuery(lead.id);
  const cycles = useLeadCyclesQuery(lead.id);
  const cycleItems = cycles.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Informações principais</CardTitle>
            <Badge variant={lead.status === "active" ? "info" : "neutral"}>
              {statusLabels[lead.status]} · {stageLabels[lead.stage]}
            </Badge>
            {lead.returnReviewPending ? (
              <Badge variant="warning">Retorno pendente</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info icon={Phone} label="Telefone" value={lead.primaryPhone} />
          <Info
            icon={Mail}
            label="E-mail"
            value={lead.email ?? "Não informado"}
          />
          <Info
            icon={Building2}
            label="Empresa"
            value={lead.companyName ?? "Não informada"}
          />
          <Info
            icon={MapPin}
            label="Cidade"
            value={lead.city ?? "Não informada"}
          />
          <Info
            icon={Building2}
            label="Instagram"
            value={lead.instagram ?? "Não informado"}
          />
          <Info
            icon={CalendarClock}
            label="Origem"
            value={lead.lastAttribution.source.replaceAll("_", " ")}
          />
          <Info
            icon={UserRound}
            label="Responsável"
            value={responsibleLabel(
              lead.responsibleMembershipId,
              currentMembershipId,
              members,
            )}
          />
          <Info
            icon={CalendarClock}
            label="Última entrada"
            value={formatDateTime(lead.latestEntry.receivedAt)}
          />
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">
              Interesse
            </p>
            <p className="mt-1 text-sm">
              {lead.serviceInterest ?? "Não informado"}
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Próxima ação</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAction.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : nextAction.isError ? (
              <p className="text-sm text-destructive">Indisponível.</p>
            ) : nextAction.data?.item ? (
              <>
                <Badge
                  variant={
                    nextAction.data.temporalState === "overdue"
                      ? "warning"
                      : "info"
                  }
                >
                  {temporalLabels[nextAction.data.temporalState]}
                </Badge>
                <p className="mt-3 font-medium">
                  {nextAction.data.item.description}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(nextAction.data.item.dueAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma próxima ação pendente.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ciclos comerciais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lead.counts.cycles}</p>
            <p className="text-sm text-muted-foreground">
              Ciclo atual #{lead.latestCycle.cycleNumber}
            </p>
            {cycleItems.length > 1 ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Ver ciclos carregados
                </summary>
                <ul className="mt-2 space-y-2 text-muted-foreground">
                  {cycleItems.map((cycle) => (
                    <li key={cycle.id}>
                      #{cycle.cycleNumber} · {formatDateTime(cycle.openedAt)}
                      {cycle.closingStatus
                        ? ` · ${statusLabels[cycle.closingStatus]}`
                        : " · aberto"}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {cycles.hasNextPage ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void cycles.fetchNextPage()}
                disabled={cycles.isFetchingNextPage}
              >
                Carregar mais ciclos
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm">{value}</p>
      </div>
    </div>
  );
}
