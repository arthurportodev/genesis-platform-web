import { createOrganizationApi } from "@/features/organizations/api/organization-api";
import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { createIdempotencyKey } from "@/shared/api/idempotency";

const created = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Agência Gênesis",
  slug: "agencia-genesis",
  membershipId: "10000000-0000-4000-8000-000000000002",
  role: "owner" as const,
};

describe("organization API", () => {
  it("creates without tenant context and validates the receipt", async () => {
    const request = vi.fn().mockResolvedValue({
      data: created,
      status: 201,
      location: `/api/v1/organizations/${created.id}`,
      idempotencyReplayed: true,
    });
    const api = createOrganizationApi({ request } as AuthenticatedHttpClient);
    const idempotencyKey = createIdempotencyKey();

    await expect(
      api.create({ name: "  Agência Gênesis  " }, idempotencyKey),
    ).resolves.toEqual({ organization: created, replayed: true });
    expect(request).toHaveBeenCalledWith("/api/v1/organizations", {
      kind: "authenticated-idempotent-mutation",
      method: "POST",
      idempotencyKey,
      body: { name: "Agência Gênesis" },
    });
  });

  it("fails closed on an invalid status, body, or Location", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: created, status: 200 })
      .mockResolvedValueOnce({
        data: { ...created, role: "admin" },
        status: 201,
        location: `/api/v1/organizations/${created.id}`,
      })
      .mockResolvedValueOnce({
        data: created,
        status: 201,
        location: "/api/v1/organizations/other",
      });
    const api = createOrganizationApi({ request } as AuthenticatedHttpClient);
    const idempotencyKey = createIdempotencyKey();
    const call = () => api.create({ name: created.name }, idempotencyKey);

    await expect(call()).rejects.toMatchObject({ kind: "protocol" });
    await expect(call()).rejects.toMatchObject({ kind: "protocol" });
    await expect(call()).rejects.toMatchObject({ kind: "protocol" });
  });
});
