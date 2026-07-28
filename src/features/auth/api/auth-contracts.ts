import { z } from "zod";

export const publicUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    email: z.email(),
    status: z.literal("active"),
  })
  .strict();

export const organizationSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    membershipId: z.uuid(),
    role: z.enum(["owner", "admin", "member"]),
  })
  .strict();

export const tokenResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int().positive(),
    user: publicUserSchema,
  })
  .strict();

export const bootstrapResponseSchema = z
  .object({
    user: publicUserSchema,
    organizations: z.array(organizationSchema),
  })
  .strict();

export const csrfResponseSchema = z
  .object({
    csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  })
  .strict();

export type PublicUser = z.infer<typeof publicUserSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
