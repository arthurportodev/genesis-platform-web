import {
  leadSources,
  type LeadMetricsSummary,
} from "@/features/leads/api/lead-contracts";
import {
  formatCivilDate,
  organizationCivilDate,
  type CivilDate,
} from "@/features/leads/model/lead-metrics-period";

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});
const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const sourceLabels: Record<(typeof leadSources)[number], string> = {
  manual: "Manual",
  landing_page: "Landing page",
  campaign: "Campanha",
  lead_magnet: "Material rico",
  other: "Outras origens",
};

export interface MetricsSourceView {
  source: string;
  label: string;
  count: number;
  percentage: number | null;
  formattedPercentage: string;
}

export function formatMetricsCount(value: number): string {
  return integerFormatter.format(value);
}

export function formatMetricsPercentage(value: number | null): string {
  return value === null ? "—" : percentageFormatter.format(value);
}

export function metricsWinRate(won: number, lost: number): number | null {
  const decidedCycles = won + lost;
  return decidedCycles === 0 ? null : won / decidedCycles;
}

export function metricsSourceLabel(source: string): string {
  return Object.hasOwn(sourceLabels, source)
    ? sourceLabels[source as keyof typeof sourceLabels]
    : "Origem não catalogada";
}

export function metricsSourceBreakdown(
  summary: LeadMetricsSummary,
): MetricsSourceView[] {
  const order = new Map<string, number>(
    leadSources.map((source, index) => [source, index]),
  );
  return summary.period.createdBySource
    .map(({ source, count }) => {
      const percentage =
        summary.period.created === 0 ? null : count / summary.period.created;
      return {
        source,
        label: metricsSourceLabel(source),
        count,
        percentage,
        formattedPercentage: formatMetricsPercentage(percentage),
      };
    })
    .sort((left, right) => {
      const leftOrder = order.get(left.source) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.source) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.source.localeCompare(right.source);
    });
}

export function formatMetricsAsOf(asOf: string, timeZone: string): string {
  const instant = new Date(asOf);
  organizationCivilDate(asOf, timeZone);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

export function formatMetricsPeriod(from: CivilDate, to: CivilDate): string {
  return from === to
    ? formatCivilDate(from)
    : `${formatCivilDate(from)} a ${formatCivilDate(to)}`;
}

export function metricLeadLabel(count: number): string {
  return count === 1 ? "Lead" : "Leads";
}

export function metricCycleLabel(count: number): string {
  return count === 1 ? "ciclo" : "ciclos";
}
