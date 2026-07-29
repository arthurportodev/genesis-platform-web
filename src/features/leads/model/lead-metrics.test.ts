import { leadMetricsSummarySchema } from "@/features/leads/api/lead-contracts";
import {
  formatMetricsAsOf,
  formatMetricsCount,
  formatMetricsPercentage,
  metricsSourceBreakdown,
  metricsSourceLabel,
  metricsWinRate,
} from "@/features/leads/model/lead-metrics";
import { testMetricsSummary } from "@/test/msw/lead-handlers";

describe("contrato e semântica de Metrics", () => {
  it("valida o payload completo e preserva source futura", () => {
    const payload = {
      ...testMetricsSummary,
      period: {
        ...testMetricsSummary.period,
        created: 2,
        createdBySource: [{ source: "partner_referral", count: 2 }],
      },
    };
    expect(
      leadMetricsSummarySchema.parse(payload).period.createdBySource[0]?.source,
    ).toBe("partner_referral");
    expect(metricsSourceLabel("partner_referral")).toBe(
      "Origem não catalogada",
    );
  });

  it.each([
    { snapshot: { ...testMetricsSummary.snapshot, active: -1 } },
    { snapshot: { ...testMetricsSummary.snapshot, active: 1.5 } },
    {
      snapshot: {
        ...testMetricsSummary.snapshot,
        active: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  ])("rejeita contagem inválida", (override) => {
    expect(
      leadMetricsSummarySchema.safeParse({ ...testMetricsSummary, ...override })
        .success,
    ).toBe(false);
  });

  it.each([
    { asOf: "ontem" },
    { timeZone: "Invalid/Zone" },
    { period: { ...testMetricsSummary.period, from: "2026-02-30" } },
    { period: { ...testMetricsSummary.period, created: 31 } },
    {
      period: {
        ...testMetricsSummary.period,
        created: 0,
        createdBySource: [{ source: "manual", count: 0 }],
      },
    },
    {
      period: {
        ...testMetricsSummary.period,
        createdBySource: [
          ...testMetricsSummary.period.createdBySource,
          testMetricsSummary.period.createdBySource[0],
        ],
      },
    },
  ])("rejeita payload inconsistente", (override) => {
    expect(
      leadMetricsSummarySchema.safeParse({ ...testMetricsSummary, ...override })
        .success,
    ).toBe(false);
  });

  it("calcula somente a taxa de ciclos e trata denominador zero", () => {
    expect(metricsWinRate(12, 8)).toBe(0.6);
    expect(metricsWinRate(0, 0)).toBeNull();
    expect(formatMetricsPercentage(0.6)).toBe("60%");
    expect(formatMetricsPercentage(null)).toBe("—");
  });

  it("formata números e horário no timezone CRM", () => {
    expect(formatMetricsCount(1234)).toBe("1.234");
    expect(
      formatMetricsAsOf("2026-07-30T02:30:00.000Z", "America/Belem"),
    ).toMatch(/29\/07\/2026.*23:30/u);
  });

  it("ordena sources canônicas e calcula participação sobre created", () => {
    const breakdown = metricsSourceBreakdown(testMetricsSummary);
    expect(breakdown.map(({ source }) => source)).toEqual([
      "manual",
      "landing_page",
      "campaign",
    ]);
    expect(
      breakdown.find(({ source }) => source === "campaign")?.percentage,
    ).toBe(0.4);
  });

  it("mantém zeros como payload válido", () => {
    const zero = leadMetricsSummarySchema.parse({
      ...testMetricsSummary,
      snapshot: {
        active: 0,
        unassigned: 0,
        overdue: 0,
        withoutNextAction: 0,
        pendingReturns: 0,
      },
      period: {
        ...testMetricsSummary.period,
        created: 0,
        won: 0,
        lost: 0,
        createdBySource: [],
      },
    });
    expect(zero.snapshot.active).toBe(0);
    expect(metricsSourceBreakdown(zero)).toEqual([]);
  });
});
