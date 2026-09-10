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

export const verificationContinuationSchema = z
  .object({
    challengeId: z.uuidv4(),
    expiresAt: z.iso.datetime({ offset: true }),
    resendAvailableAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const verificationRequiredResponseSchema = verificationContinuationSchema
  .extend({
    status: z.literal("verification_required"),
    delivery: z.enum(["sent", "delivery_unavailable"]),
  })
  .strict();

export const emailVerifiedResponseSchema = z
  .object({ status: z.literal("email_verified") })
  .strict();

export const passwordResetAcceptedResponseSchema = z
  .object({
    status: z.literal("accepted"),
    expiresAt: z.iso.datetime({ offset: true }),
    resendAvailableAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const passwordResetCompletedResponseSchema = z
  .object({ status: z.literal("password_reset") })
  .strict();

export const googleConfigResponseSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false), clientId: z.null() }).strict(),
  z
    .object({ enabled: z.literal(true), clientId: z.string().min(1).max(512) })
    .strict(),
]);

export const googleChallengeResponseSchema = z
  .object({
    challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type PublicUser = z.infer<typeof publicUserSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
export type VerificationContinuation = z.infer<
  typeof verificationContinuationSchema
>;
export type VerificationRequiredResponse = z.infer<
  typeof verificationRequiredResponseSchema
>;
export type EmailVerifiedResponse = z.infer<typeof emailVerifiedResponseSchema>;
export type PasswordResetAcceptedResponse = z.infer<
  typeof passwordResetAcceptedResponseSchema
>;
export type PasswordResetCompletedResponse = z.infer<
  typeof passwordResetCompletedResponseSchema
>;
export type GoogleConfigResponse = z.infer<typeof googleConfigResponseSchema>;
export type GoogleChallengeResponse = z.infer<
  typeof googleChallengeResponseSchema
>;
