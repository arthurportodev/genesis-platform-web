import { createLeadInputSchema } from "@/features/leads/api/lead-contracts";
import {
  buildCreateLeadInput,
  defaultLeadCreateValues,
  formatLeadPhoneOnBlur,
  leadCreateFormSchema,
} from "@/features/leads/model/lead-create";

describe("criação manual de Lead", () => {
  it("normaliza o payload e omite opcionais vazios", () => {
    const values = leadCreateFormSchema.parse({
      ...defaultLeadCreateValues,
      displayName: "  Lead Manual  ",
      primaryPhone: "  (62) 99999-9999  ",
      email: "  LEAD@EXAMPLE.TEST  ",
    });
    expect(buildCreateLeadInput(values, true)).toEqual({
      displayName: "Lead Manual",
      primaryPhone: "(62) 99999-9999",
      email: "lead@example.test",
      source: "manual",
    });
  });

  it("exige detalhe somente para outra origem e preserva UTMs", () => {
    expect(
      leadCreateFormSchema.safeParse({
        ...defaultLeadCreateValues,
        displayName: "Lead",
        primaryPhone: "+1 202-555-0123",
        source: "other",
      }).success,
    ).toBe(false);
    const values = leadCreateFormSchema.parse({
      ...defaultLeadCreateValues,
      displayName: "Lead",
      primaryPhone: "+1 202-555-0123",
      source: "other",
      sourceDetail: "  Indicação local ",
      utmCampaign: "  inverno-2026 ",
    });
    expect(buildCreateLeadInput(values, true)).toMatchObject({
      source: "other",
      sourceDetail: "Indicação local",
      utmCampaign: "inverno-2026",
    });
  });

  it("nunca envia responsável para member", () => {
    const values = leadCreateFormSchema.parse({
      ...defaultLeadCreateValues,
      displayName: "Lead",
      primaryPhone: "11999999999",
      responsibleMembershipId: "00000000-0000-4000-8000-000000000011",
    });
    expect(buildCreateLeadInput(values, false)).not.toHaveProperty(
      "responsibleMembershipId",
    );
  });

  it.each([
    ["", undefined],
    ["0", "0"],
    ["1.234,56", "123456"],
    ["90.071.992.547.409,93", "9007199254740993"],
  ])("converte valor da oportunidade %j", (expectedValue, minorUnits) => {
    const values = leadCreateFormSchema.parse({
      ...defaultLeadCreateValues,
      displayName: "Lead",
      primaryPhone: "11999999999",
      expectedValue,
    });
    const input = buildCreateLeadInput(values, true);
    expect(input.expectedValueMinor).toBe(minorUnits);
  });

  it("mantém internacional e aplica máscara brasileira não destrutiva", () => {
    expect(formatLeadPhoneOnBlur(" +1 202-555-0123 ")).toBe("+1 202-555-0123");
    expect(formatLeadPhoneOnBlur("62999999999")).toBe("(62) 99999-9999");
    expect(formatLeadPhoneOnBlur("ramal 123")).toBe("ramal 123");
  });

  it("aplica source manual por default e rejeita campo inventado", () => {
    expect(
      createLeadInputSchema.parse({
        displayName: "Lead",
        primaryPhone: "11999999999",
      }).source,
    ).toBe("manual");
    expect(() =>
      createLeadInputSchema.parse({
        displayName: "Lead",
        primaryPhone: "11999999999",
        observations: "Não contratado",
      }),
    ).toThrow();
  });
});
