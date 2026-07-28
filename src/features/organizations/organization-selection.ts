import type { Organization } from "@/features/auth/api/auth-contracts";
import { environment } from "@/shared/config/environment";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type OrganizationResolution =
  | { kind: "none-available" }
  | { kind: "selected"; organization: Organization }
  | { kind: "selection-required" };

export interface OrganizationPreferenceStore {
  read(): string | null;
  write(organizationId: string): void;
  clear(): void;
}

export function createOrganizationPreferenceStore(
  storage: Storage | undefined = typeof window === "undefined"
    ? undefined
    : window.localStorage,
): OrganizationPreferenceStore {
  return {
    read() {
      try {
        const value = storage?.getItem(
          environment.activeOrganizationStorageKey,
        );
        return value && UUID.test(value) ? value : null;
      } catch {
        return null;
      }
    },
    write(organizationId) {
      if (!UUID.test(organizationId))
        throw new Error("Organization deve possuir UUID válido.");
      try {
        storage?.setItem(
          environment.activeOrganizationStorageKey,
          organizationId,
        );
      } catch {
        // A sessão continua em memória quando storage está indisponível.
      }
    },
    clear() {
      try {
        storage?.removeItem(environment.activeOrganizationStorageKey);
      } catch {
        // Limpeza best-effort em storage indisponível.
      }
    },
  };
}

export function resolveOrganization(
  organizations: readonly Organization[],
  persistedOrganizationId: string | null,
): OrganizationResolution {
  if (organizations.length === 0) return { kind: "none-available" };
  if (organizations.length === 1)
    return { kind: "selected", organization: organizations[0] };
  if (persistedOrganizationId) {
    const selected = organizations.find(
      ({ id }) => id === persistedOrganizationId,
    );
    if (selected) return { kind: "selected", organization: selected };
  }
  return { kind: "selection-required" };
}
