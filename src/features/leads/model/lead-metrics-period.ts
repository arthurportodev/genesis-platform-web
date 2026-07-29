export type CivilDate = string & { readonly __civilDate: unique symbol };

export type CanonicalMetricsPeriod =
  | { readonly kind: "default" }
  | {
      readonly kind: "range";
      readonly from: CivilDate;
      readonly to: CivilDate;
    };

export type MetricsPreset =
  "last7" | "last30" | "last90" | "currentMonth" | "custom";

export interface MetricsSearch {
  from?: CivilDate;
  to?: CivilDate;
  invalidPeriodReason?: string;
}

const safeInvalidPeriodReasons = new Set([
  "Parâmetros de período desconhecidos foram ignorados.",
  "Informe as datas inicial e final do período.",
  "Data civil inválida.",
  "A data inicial deve ser anterior à final.",
  "O período aceita no máximo 366 dias.",
  "O período informado é inválido.",
]);

interface CivilDateParts {
  year: number;
  month: number;
  day: number;
}

const civilDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function civilParts(value: string): CivilDateParts | null {
  const match = civilDatePattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month))
    return null;
  return { year, month, day };
}

function formatParts({ year, month, day }: CivilDateParts): CivilDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` as CivilDate;
}

function civilDayNumber(value: CivilDate): number {
  const parts = civilParts(value);
  if (!parts) throw new Error("Data civil inválida.");
  const adjustedYear = parts.year - (parts.month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const shiftedMonth = parts.month + (parts.month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + parts.day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra;
}

export function isValidCivilDate(value: string): value is CivilDate {
  return civilParts(value) !== null;
}

export function asCivilDate(value: string): CivilDate {
  if (!isValidCivilDate(value)) throw new Error("Data civil inválida.");
  return value;
}

export function inclusiveCivilDays(from: CivilDate, to: CivilDate): number {
  return civilDayNumber(to) - civilDayNumber(from) + 1;
}

export function previousCivilDate(value: CivilDate): CivilDate {
  const parts = civilParts(value);
  if (!parts) throw new Error("Data civil inválida.");
  if (parts.day > 1) return formatParts({ ...parts, day: parts.day - 1 });
  if (parts.month > 1) {
    const month = parts.month - 1;
    return formatParts({
      year: parts.year,
      month,
      day: daysInMonth(parts.year, month),
    });
  }
  if (parts.year === 0) throw new Error("Data civil fora do intervalo.");
  return formatParts({ year: parts.year - 1, month: 12, day: 31 });
}

export function subtractCivilDays(value: CivilDate, days: number): CivilDate {
  if (!Number.isInteger(days) || days < 0 || days > 365)
    throw new Error("Deslocamento civil inválido.");
  let result = value;
  for (let index = 0; index < days; index += 1)
    result = previousCivilDate(result);
  return result;
}

export function canonicalMetricsRange(
  fromValue: string,
  toValue: string,
): CanonicalMetricsPeriod {
  const from = asCivilDate(fromValue);
  const to = asCivilDate(toValue);
  const days = inclusiveCivilDays(from, to);
  if (days < 1) throw new Error("A data inicial deve ser anterior à final.");
  if (days > 366) throw new Error("O período aceita no máximo 366 dias.");
  return { kind: "range", from, to };
}

export function canonicalMetricsPeriodFromSearch(
  search: Pick<MetricsSearch, "from" | "to">,
): CanonicalMetricsPeriod {
  return search.from && search.to
    ? canonicalMetricsRange(search.from, search.to)
    : { kind: "default" };
}

export function parseMetricsSearch(
  search: Record<string, unknown>,
): MetricsSearch {
  const preservedReason =
    typeof search.invalidPeriodReason === "string" &&
    safeInvalidPeriodReasons.has(search.invalidPeriodReason)
      ? search.invalidPeriodReason
      : undefined;
  const unexpected = Object.keys(search).filter(
    (key) =>
      key !== "from" &&
      key !== "to" &&
      !(key === "invalidPeriodReason" && preservedReason),
  );
  if (unexpected.length > 0)
    return {
      invalidPeriodReason:
        "Parâmetros de período desconhecidos foram ignorados.",
    };
  if (preservedReason) return { invalidPeriodReason: preservedReason };
  const from = typeof search.from === "string" ? search.from : undefined;
  const to = typeof search.to === "string" ? search.to : undefined;
  if (!from && !to) return {};
  if (!from || !to)
    return {
      invalidPeriodReason: "Informe as datas inicial e final do período.",
    };
  try {
    const period = canonicalMetricsRange(from, to);
    if (period.kind !== "range") return {};
    return { from: period.from, to: period.to };
  } catch (error) {
    return {
      invalidPeriodReason:
        error instanceof Error
          ? error.message
          : "O período informado é inválido.",
    };
  }
}

export function validateMetricsSearch(
  search: Record<string, unknown>,
): MetricsSearch {
  return parseMetricsSearch(search);
}

export function metricsPeriodForPreset(
  preset: Exclude<MetricsPreset, "custom">,
  organizationToday: CivilDate,
): CanonicalMetricsPeriod {
  if (preset === "last30") return { kind: "default" };
  if (preset === "currentMonth") {
    return {
      kind: "range",
      from: `${organizationToday.slice(0, 7)}-01` as CivilDate,
      to: organizationToday,
    };
  }
  const days = preset === "last7" ? 7 : 90;
  return {
    kind: "range",
    from: subtractCivilDays(organizationToday, days - 1),
    to: organizationToday,
  };
}

export function identifyMetricsPreset(
  period: CanonicalMetricsPeriod,
  organizationToday?: CivilDate,
): MetricsPreset {
  if (period.kind === "default") return "last30";
  if (!organizationToday) return "custom";
  for (const preset of ["last7", "last90", "currentMonth"] as const) {
    const candidate = metricsPeriodForPreset(preset, organizationToday);
    if (
      candidate.kind === "range" &&
      candidate.from === period.from &&
      candidate.to === period.to
    )
      return preset;
  }
  return "custom";
}

export function isUsableTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function organizationCivilDate(
  asOf: string,
  timeZone: string,
): CivilDate {
  if (!isUsableTimeZone(timeZone)) throw new Error("Timezone inválido.");
  const instant = new Date(asOf);
  if (Number.isNaN(instant.getTime())) throw new Error("Instante inválido.");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return asCivilDate(`${value.year}-${value.month}-${value.day}`);
}

export function formatCivilDate(value: CivilDate): string {
  const parts = civilParts(value);
  if (!parts) throw new Error("Data civil inválida.");
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${String(parts.year).padStart(4, "0")}`;
}
