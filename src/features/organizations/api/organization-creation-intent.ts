import type { CreateOrganizationInput } from "@/features/organizations/api/organization-contracts";
import { normalizeOrganizationName } from "@/features/organizations/api/organization-contracts";
import {
  createIdempotencyKey,
  type IdempotencyKey,
} from "@/shared/api/idempotency";

export interface OrganizationCreationIntent {
  input: Readonly<CreateOrganizationInput>;
  key: IdempotencyKey;
}

export class OrganizationCreationIntentRegistry {
  #current: OrganizationCreationIntent | null = null;

  begin(input: CreateOrganizationInput): OrganizationCreationIntent {
    const name = normalizeOrganizationName(input.name);
    if (this.#current?.input.name === name) return this.#current;
    const intent = {
      input: Object.freeze({ name }),
      key: createIdempotencyKey(),
    };
    this.#current = intent;
    return intent;
  }

  forgetIfNameChanged(name: string): void {
    if (
      this.#current &&
      this.#current.input.name !== normalizeOrganizationName(name)
    )
      this.#current = null;
  }

  forget(): void {
    this.#current = null;
  }
}
