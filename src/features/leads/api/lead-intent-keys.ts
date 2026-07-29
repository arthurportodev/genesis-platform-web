import type { LeadIdempotentAction } from "@/features/leads/api/lead-api";
import type { CreateLeadInput } from "@/features/leads/api/lead-contracts";
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
    context?: Readonly<Record<string, unknown>>,
  ): IdempotencyKey {
    const fingerprint = JSON.stringify({ intent, sourceRevision, context });
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

export interface LeadCreateIntent {
  organizationId: string;
  actorMembershipId: string;
  payload: Readonly<CreateLeadInput>;
  key: IdempotencyKey;
}

export class LeadCreateIntentRegistry {
  #current: { fingerprint: string; intent: LeadCreateIntent } | null = null;

  begin(
    organizationId: string,
    actorMembershipId: string,
    payload: CreateLeadInput,
  ): LeadCreateIntent {
    const fingerprint = JSON.stringify({
      organizationId,
      actorMembershipId,
      payload,
    });
    if (this.#current?.fingerprint === fingerprint) return this.#current.intent;
    const intent = {
      organizationId,
      actorMembershipId,
      payload: Object.freeze({ ...payload }),
      key: createIdempotencyKey(),
    };
    this.#current = { fingerprint, intent };
    return intent;
  }

  current(): LeadCreateIntent | null {
    return this.#current?.intent ?? null;
  }

  forget(): void {
    this.#current = null;
  }
}

export function hasUncertainLeadCreationOutcome(kind: AppErrorKind): boolean {
  return hasUncertainMutationOutcome(kind) || kind === "server";
}

export function hasUncertainMutationOutcome(kind: AppErrorKind): boolean {
  return (
    kind === "network" ||
    kind === "timeout" ||
    kind === "protocol" ||
    kind === "unknown"
  );
}
