import {
  formatBrlInput,
  formatBrlInputFromMinorUnits,
  formatBrlMinorUnits,
  parseBrlToMinorUnits,
} from "@/features/leads/model/lead-money";

describe("formatBrlMinorUnits", () => {
  it.each([
    ["0", "R$ 0,00"],
    ["1", "R$ 0,01"],
    ["99", "R$ 0,99"],
    ["100", "R$ 1,00"],
    ["123456", "R$ 1.234,56"],
    ["123456789", "R$ 1.234.567,89"],
    ["900719925474099300", "R$ 9.007.199.254.740.993,00"],
    [
      "123456789012345678901234567890",
      "R$ 1.234.567.890.123.456.789.012.345.678,90",
    ],
  ])("formata %s sem perda de precisão", (input, output) => {
    expect(formatBrlMinorUnits(input)).toBe(output);
  });

  it.each(["", "00", "01", "-1", "+1", "1.2", "1e2", " 1"])(
    "rejeita entrada não canônica %j",
    (input) => {
      expect(() => formatBrlMinorUnits(input)).toThrow(TypeError);
    },
  );
});

describe("entrada monetária em BRL", () => {
  it.each([
    ["", null],
    ["0", "0"],
    ["0,00", "0"],
    ["0,01", "1"],
    ["12,3", "1230"],
    ["1.234,56", "123456"],
    ["90071992547409,93", "9007199254740993"],
    ["92.233.720.368.547.758,07", "9223372036854775807"],
  ])("converte %j para minor units sem Number", (input, output) => {
    expect(parseBrlToMinorUnits(input)).toBe(output);
  });

  it.each([
    "00",
    "01",
    "-1",
    "+1",
    "1.2345",
    "1,234",
    "1e3",
    "1,2,3",
    "92.233.720.368.547.758,08",
  ])("rejeita e preserva a entrada inválida %j", (input) => {
    expect(() => parseBrlToMinorUnits(input)).toThrow(TypeError);
    expect(input).toBe(input);
  });

  it("formata apenas no blur e mantém o prefixo fora do texto", () => {
    expect(formatBrlInput("1234,5")).toBe("1.234,50");
    expect(formatBrlInputFromMinorUnits("123450")).toBe("1.234,50");
    expect(formatBrlInputFromMinorUnits(null)).toBe("");
  });
});
