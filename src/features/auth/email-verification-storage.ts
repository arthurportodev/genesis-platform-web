import { z } from "zod";

import {
  verificationContinuationSchema,
  type VerificationContinuation,
  type VerificationRequiredResponse,
} from "@/features/auth/api/auth-contracts";

const STORAGE_KEY = "genesis.emailVerification.v1";

const storedContinuationSchema = verificationContinuationSchema
  .extend({
    version: z.literal(1),
    delivery: z.enum(["sent", "delivery_unavailable"]).optional(),
  })
  .strict();

export type StoredVerificationContinuation = z.infer<
  typeof storedContinuationSchema
>;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function readVerificationContinuation(
  now = Date.now(),
): StoredVerificationContinuation | null {
  const target = storage();
  if (!target) return null;
  const raw = target.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = storedContinuationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= now) {
      target.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    target.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeVerificationContinuation(
  continuation: VerificationContinuation,
  delivery?: VerificationRequiredResponse["delivery"],
): StoredVerificationContinuation {
  const value = storedContinuationSchema.parse({
    version: 1,
    challengeId: continuation.challengeId,
    expiresAt: continuation.expiresAt,
    resendAvailableAt: continuation.resendAvailableAt,
    ...(delivery ? { delivery } : {}),
  });
  storage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearVerificationContinuation(): void {
  storage()?.removeItem(STORAGE_KEY);
}
