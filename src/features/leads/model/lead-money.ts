const canonicalMinorUnits = /^(0|[1-9]\d*)$/u;
const brlInput = /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/u;
const postgresBigintMax = "9223372036854775807";

function assertFitsPostgresBigint(value: string): void {
  if (
    value.length > postgresBigintMax.length ||
    (value.length === postgresBigintMax.length && value > postgresBigintMax)
  ) {
    throw new TypeError("O valor excede o limite permitido.");
  }
}

export function formatBrlMinorUnits(value: string): string {
  if (!canonicalMinorUnits.test(value)) {
    throw new TypeError(
      "Minor units must be a canonical non-negative integer.",
    );
  }

  const padded = value.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");
  const cents = padded.slice(-2);
  return `R$ ${integer},${cents}`;
}

export function parseBrlToMinorUnits(value: string): string | null {
  const normalized = value.trim();
  if (normalized === "") return null;
  if (!brlInput.test(normalized)) {
    throw new TypeError(
      "Informe um valor em reais com até duas casas decimais.",
    );
  }

  const [integerPart, decimalPart = ""] = normalized.split(",");
  const integer = integerPart.replace(/\./gu, "");
  const canonical = `${integer}${decimalPart.padEnd(2, "0")}`.replace(
    /^0+(?=\d)/u,
    "",
  );
  assertFitsPostgresBigint(canonical);
  return canonical;
}

export function formatBrlInput(value: string): string {
  const minorUnits = parseBrlToMinorUnits(value);
  return minorUnits === null ? "" : formatBrlMinorUnits(minorUnits).slice(3);
}

export function formatBrlInputFromMinorUnits(value: string | null): string {
  return value === null ? "" : formatBrlMinorUnits(value).slice(3);
}
