import type { LeadMetricsSummary } from "@/features/leads/api/lead-contracts";
import { formatMetricsCount } from "@/features/leads/model/lead-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";

const snapshotCards: Array<{
  key: keyof LeadMetricsSummary["snapshot"];
  label: string;
  description: string;
}> = [
  {
    key: "active",
    label: "Leads ativos",
    description: "Leads cujo estado atual permanece ativo.",
  },
  {
    key: "unassigned",
    label: "Sem responsável",
    description: "Leads ativos ainda sem responsável definido.",
  },
  {
    key: "overdue",
    label: "Ações atrasadas",
    description:
      "Leads ativos com próxima ação pendente anterior à atualização.",
  },
  {
    key: "withoutNextAction",
    label: "Sem próxima ação",
    description: "Leads ativos sem uma próxima ação pendente.",
  },
  {
    key: "pendingReturns",
    label: "Retornos pendentes",
    description: "Leads com retorno aguardando revisão administrativa.",
  },
];

export function LeadMetricsSnapshot({
  snapshot,
}: {
  snapshot: LeadMetricsSummary["snapshot"];
}) {
  return (
    <section
      aria-labelledby="lead-metrics-snapshot-title"
      className="space-y-4"
    >
      <div>
        <h2 id="lead-metrics-snapshot-title" className="text-xl font-semibold">
          Visão atual
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado da operação no horário da última atualização.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {snapshotCards.map((card) => {
          const value = snapshot[card.key];
          return (
            <Card key={card.key} role="group" aria-label={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums">
                  {formatMetricsCount(value)}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
