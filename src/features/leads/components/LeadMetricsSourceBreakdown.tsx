import type { LeadMetricsSummary } from "@/features/leads/api/lead-contracts";
import {
  formatMetricsCount,
  metricLeadLabel,
  metricsSourceBreakdown,
} from "@/features/leads/model/lead-metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";

export function LeadMetricsSourceBreakdown({
  summary,
}: {
  summary: LeadMetricsSummary;
}) {
  const sources = metricsSourceBreakdown(summary);
  return (
    <section aria-labelledby="lead-metrics-sources-title" className="space-y-4">
      <div>
        <h2 id="lead-metrics-sources-title" className="text-xl font-semibold">
          Origem dos Leads
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Distribuição da origem inicial dos Leads criados no período.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participação por origem</CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              Nenhum Lead foi criado no período selecionado.
            </p>
          ) : (
            <ul className="space-y-5" aria-label="Leads criados por origem">
              {sources.map((source) => {
                const accessible = `${source.label}: ${formatMetricsCount(source.count)} ${metricLeadLabel(source.count)}, ${source.formattedPercentage} dos Leads criados`;
                return (
                  <li key={source.source} aria-label={accessible}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <p className="font-medium">
                        {source.label}
                        {source.label === "Origem não catalogada" ? (
                          <span className="ml-2 break-all text-xs font-normal text-muted-foreground">
                            ({source.source})
                          </span>
                        ) : null}
                      </p>
                      <p className="tabular-nums text-muted-foreground">
                        {formatMetricsCount(source.count)} ·{" "}
                        {source.formattedPercentage}
                      </p>
                    </div>
                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-primary motion-reduce:transition-none"
                        style={{
                          width: `${Math.min(100, (source.percentage ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
