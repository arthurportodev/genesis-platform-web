import {
  createOrganizationInputSchema,
  createdOrganizationSchema,
  type CreateOrganizationInput,
  type CreatedOrganization,
} from "@/features/organizations/api/organization-contracts";
import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { AppError } from "@/shared/api/errors";
import type { IdempotencyKey } from "@/shared/api/idempotency";

export interface CreateOrganizationResult {
  organization: CreatedOrganization;
  replayed: boolean;
}

export function createOrganizationApi(http: AuthenticatedHttpClient) {
  return {
    async create(
      input: CreateOrganizationInput,
      idempotencyKey: IdempotencyKey,
    ): Promise<CreateOrganizationResult> {
      const response = await http.request<unknown>("/api/v1/organizations", {
        kind: "authenticated-idempotent-mutation",
        method: "POST",
        idempotencyKey,
        body: createOrganizationInputSchema.parse(input),
      });
      if (response.status !== 201)
        throw new AppError(
          "protocol",
          "A API retornou um status inesperado para a criação da organização.",
        );
      const parsed = createdOrganizationSchema.safeParse(response.data);
      if (!parsed.success)
        throw new AppError(
          "protocol",
          "A API retornou uma organização inválida.",
          { cause: parsed.error },
        );
      const expectedLocation = `/api/v1/organizations/${parsed.data.id}`;
      if (response.location !== expectedLocation)
        throw new AppError(
          "protocol",
          "A API não retornou a localização da organização criada.",
        );
      return {
        organization: parsed.data,
        replayed: response.idempotencyReplayed === true,
      };
    },
  };
}
