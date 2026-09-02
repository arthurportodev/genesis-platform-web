import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";

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
