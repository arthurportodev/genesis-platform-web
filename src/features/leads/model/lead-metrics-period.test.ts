import {
  asCivilDate,
  canonicalMetricsRange,
  formatCivilDate,
  identifyMetricsPreset,
  inclusiveCivilDays,
  metricsPeriodForPreset,
  organizationCivilDate,
  parseMetricsSearch,
  subtractCivilDays,
  validateMetricsSearch,
} from "@/features/leads/model/lead-metrics-period";

describe("período civil das métricas", () => {
  it("preserva o default sem materializá-lo", () => {
    expect(parseMetricsSearch({})).toEqual({});
    expect(metricsPeriodForPreset("last30", asCivilDate("2026-07-29"))).toEqual(
      {
        kind: "default",
      },
    );
    expect(identifyMetricsPreset({ kind: "default" })).toBe("last30");
  });

  it.each([
    ["last7", "2026-07-23", "2026-07-29"],
    ["last90", "2026-05-01", "2026-07-29"],
    ["currentMonth", "2026-07-01", "2026-07-29"],
  ] as const)("calcula %s no calendário civil", (preset, from, to) => {
    expect(metricsPeriodForPreset(preset, asCivilDate("2026-07-29"))).toEqual({
      kind: "range",
      from,
      to,
    });
  });

  it("atravessa ano, mês e dia bissexto sem Date UTC", () => {
    expect(subtractCivilDays(asCivilDate("2026-01-01"), 1)).toBe("2025-12-31");
    expect(subtractCivilDays(asCivilDate("2024-03-01"), 1)).toBe("2024-02-29");
    expect(subtractCivilDays(asCivilDate("2026-03-01"), 1)).toBe("2026-02-28");
  });

  it("aceita um dia, 366 dias e datas futuras", () => {
    expect(canonicalMetricsRange("2026-08-10", "2026-08-10")).toMatchObject({
      kind: "range",
    });
    expect(
      inclusiveCivilDays(asCivilDate("2024-01-01"), asCivilDate("2024-12-31")),
    ).toBe(366);
    expect(canonicalMetricsRange("2024-01-01", "2024-12-31")).toBeDefined();
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-03-02", "2026-03-01"],
    ["2024-01-01", "2025-01-01"],
  ])("rejeita range inválido %s..%s", (from, to) => {
    expect(() => canonicalMetricsRange(from, to)).toThrow();
  });

  it("rejeita URL parcial, desconhecida e inválida", () => {
    expect(
      parseMetricsSearch({ from: "2026-07-01" }).invalidPeriodReason,
    ).toBeTruthy();
    expect(
      parseMetricsSearch({ to: "2026-07-01" }).invalidPeriodReason,
    ).toBeTruthy();
    expect(
      parseMetricsSearch({ from: "bad", to: "2026-07-01" }).invalidPeriodReason,
    ).toBeTruthy();
    expect(parseMetricsSearch({ page: "2" }).invalidPeriodReason).toBeTruthy();
    expect(
      validateMetricsSearch({ from: ["2026-07-01"], to: "2026-07-29" })
        .invalidPeriodReason,
    ).toBeTruthy();
    expect(
      validateMetricsSearch({ invalidPeriodReason: "conteúdo externo" })
        .invalidPeriodReason,
    ).toBe("Parâmetros de período desconhecidos foram ignorados.");
    expect(
      parseMetricsSearch({ from: "2026-07-01", to: "2026-07-29" }),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-29",
    });
  });

  it("deriva o dia no timezone da Organization", () => {
    expect(
      organizationCivilDate("2026-07-30T02:30:00.000Z", "America/Belem"),
    ).toBe("2026-07-29");
    expect(formatCivilDate(asCivilDate("2026-07-29"))).toBe("29/07/2026");
    expect(() =>
      organizationCivilDate("2026-07-29T12:00:00Z", "Invalid/Zone"),
    ).toThrow();
  });
});
