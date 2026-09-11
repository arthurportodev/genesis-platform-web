import { z } from "zod";

const forbiddenNameCharacters = /[\p{Cc}\p{Cs}\u2028\u2029]/u;
const organizationNameMaximum = 160;

function hasValidOrganizationNameLength(value: string): boolean {
  return Array.from(value).length <= organizationNameMaximum;
}

export function normalizeOrganizationName(value: string): string {
  return value.normalize("NFC").trim();
}

export const createOrganizationInputSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeOrganizationName)
      .pipe(
        z
          .string()
          .min(1, "Informe o nome da organização.")
          .refine(
            hasValidOrganizationNameLength,
            "Use no máximo 160 caracteres.",
          )
          .refine(
            (value) => !forbiddenNameCharacters.test(value),
            "O nome contém caracteres não permitidos.",
          ),
      ),
  })
  .strict();

export const createdOrganizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).refine(hasValidOrganizationNameLength),
    slug: z.string().min(1).max(120),
    membershipId: z.uuid(),
    role: z.literal("owner"),
  })
  .strict();

export type CreateOrganizationInput = z.input<
  typeof createOrganizationInputSchema
>;
export type CreatedOrganization = z.infer<typeof createdOrganizationSchema>;
