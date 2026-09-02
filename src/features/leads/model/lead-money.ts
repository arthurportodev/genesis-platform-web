const canonicalMinorUnits = /^(0|[1-9]\d*)$/u;

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
