import type { LeadIdempotentAction } from "@/features/leads/api/lead-api";
import type { AppErrorKind } from "@/shared/api/errors";
import {
  createIdempotencyKey,
  type IdempotencyKey,
} from "@/shared/api/idempotency";

interface StoredIntentKey {
  fingerprint: string;
  key: IdempotencyKey;
}

export class LeadIntentKeyRegistry {
  readonly #keys = new Map<string, StoredIntentKey>();

  keyFor(
    name: string,
    intent: LeadIdempotentAction,
    sourceRevision: string,
  ): IdempotencyKey {
    const fingerprint = JSON.stringify({ intent, sourceRevision });
    const stored = this.#keys.get(name);
    if (stored?.fingerprint === fingerprint) return stored.key;
    const key = createIdempotencyKey();
    this.#keys.set(name, { fingerprint, key });
    return key;
  }

  forget(name: string): void {
    this.#keys.delete(name);
  }
}

export function hasUncertainMutationOutcome(kind: AppErrorKind): boolean {
  return (
    kind === "network" ||
    kind === "timeout" ||
    kind === "protocol" ||
    kind === "unknown"
  );
}
