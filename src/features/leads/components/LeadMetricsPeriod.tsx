import type { LeadMetricsSummary } from "@/features/leads/api/lead-contracts";
import {
  formatMetricsCount,
  formatMetricsPercentage,
  metricsWinRate,
} from "@/features/leads/model/lead-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";

export function LeadMetricsPeriod({
  period,
}: {
  period: LeadMetricsSummary["period"];
}) {
  const winRate = metricsWinRate(period.won, period.lost);
  const cards = [
    {
      key: "created",
      label: "Leads criados",
      value: formatMetricsCount(period.created),
      description: "Leads efetivamente criados no período selecionado.",
    },
    {
      key: "won",
      label: "Ciclos ganhos",
      value: formatMetricsCount(period.won),
      description: "Ciclos comerciais encerrados como ganhos no período.",
    },
    {
      key: "lost",
      label: "Ciclos perdidos",
      value: formatMetricsCount(period.lost),
      description: "Ciclos comerciais encerrados como perdidos no período.",
    },
    {
      key: "rate",
      label: "Taxa de ganho entre ciclos ganhos ou perdidos",
      value: formatMetricsPercentage(winRate),
      description:
        winRate === null
          ? "Ainda não houve ciclo ganho ou perdido no período."
          : "Proporção de ganhos somente entre os ciclos ganhos ou perdidos.",
    },
  ] as const;

  return (
    <section aria-labelledby="lead-metrics-period-title" className="space-y-4">
      <div>
        <h2 id="lead-metrics-period-title" className="text-xl font-semibold">
          Desempenho do período
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads criados e ciclos encerrados são medidas distintas e não devem
          ser comparados diretamente.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key} role="group" aria-label={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{card.value}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
