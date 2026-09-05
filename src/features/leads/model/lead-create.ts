import { z } from "zod";

import {
  createLeadInputSchema,
  leadSources,
  type CreateLeadInput,
} from "@/features/leads/api/lead-contracts";
import { parseBrlToMinorUnits } from "@/features/leads/model/lead-money";

const optionalFormText = (maximum: number) =>
  z.string().trim().max(maximum, `Use no máximo ${maximum} caracteres.`);

export const leadCreateFormSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Informe o nome do Lead.")
      .max(160, "Use no máximo 160 caracteres."),
    primaryPhone: z
      .string()
      .trim()
      .min(1, "Informe o telefone.")
      .max(40, "Use no máximo 40 caracteres."),
    email: optionalFormText(320).refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Informe um e-mail válido.",
    ),
    companyName: optionalFormText(160),
    instagram: optionalFormText(64),
    city: optionalFormText(120),
    serviceInterest: optionalFormText(160),
    expectedValue: z.string().refine((value) => {
      try {
        parseBrlToMinorUnits(value);
        return true;
      } catch {
        return false;
      }
    }, "Informe um valor em reais com até duas casas decimais."),
    source: z.enum(leadSources),
    sourceDetail: optionalFormText(120),
    utmSource: optionalFormText(255),
    utmMedium: optionalFormText(255),
    utmCampaign: optionalFormText(255),
    utmContent: optionalFormText(255),
    utmTerm: optionalFormText(255),
    responsibleMembershipId: z
      .string()
      .refine(
        (value) => value === "" || z.uuid().safeParse(value).success,
        "Selecione um responsável válido.",
      ),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.source === "other" && values.sourceDetail.trim() === "") {
      context.addIssue({
        code: "custom",
        path: ["sourceDetail"],
        message: "Detalhe a outra origem.",
      });
    }
  });

export type LeadCreateFormValues = z.infer<typeof leadCreateFormSchema>;

export const defaultLeadCreateValues: LeadCreateFormValues = {
  displayName: "",
  primaryPhone: "",
  email: "",
  companyName: "",
  instagram: "",
  city: "",
  serviceInterest: "",
  expectedValue: "",
  source: "manual",
  sourceDetail: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  responsibleMembershipId: "",
};

const optional = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
};

export function buildCreateLeadInput(
  values: LeadCreateFormValues,
  canChooseResponsible: boolean,
): CreateLeadInput {
  const expectedValueMinor = parseBrlToMinorUnits(values.expectedValue);
  const candidate = {
    displayName: values.displayName.trim(),
    primaryPhone: values.primaryPhone.trim(),
    email: optional(values.email)?.toLowerCase(),
    companyName: optional(values.companyName),
    instagram: optional(values.instagram),
    city: optional(values.city),
    serviceInterest: optional(values.serviceInterest),
    expectedValueMinor: expectedValueMinor ?? undefined,
    source: values.source,
    sourceDetail:
      values.source === "other" ? optional(values.sourceDetail) : undefined,
    utmSource: optional(values.utmSource),
    utmMedium: optional(values.utmMedium),
    utmCampaign: optional(values.utmCampaign),
    utmContent: optional(values.utmContent),
    utmTerm: optional(values.utmTerm),
    responsibleMembershipId: canChooseResponsible
      ? optional(values.responsibleMembershipId)
      : undefined,
  };
  return createLeadInputSchema.parse(
    Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== undefined),
    ),
  );
}

export function formatLeadPhoneOnBlur(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  if (!/^[\d\s().-]+$/u.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/gu, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return trimmed;
}
