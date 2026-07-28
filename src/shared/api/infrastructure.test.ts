import { asEntityTag, ifMatchHeader } from "@/shared/api/etag";
import { createIdempotencyKey } from "@/shared/api/idempotency";
import {
  isAuthenticatedQueryKey,
  isOrganizationQueryKey,
  queryKeys,
} from "@/shared/api/query-keys";

describe("infraestrutura HTTP futura", () => {
  it("preserva ETag opaco sem interpretar seu formato", () => {
    const etag = asEntityTag('W/"opaque-revision"');
    expect(etag && ifMatchHeader(etag)).toEqual({
      "If-Match": 'W/"opaque-revision"',
    });
  });

  it("gera uma chave por intenção e permite reuso explícito", () => {
    const first = createIdempotencyKey();
    const second = createIdempotencyKey();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("segmenta cache público, de conta e por Organization", () => {
    const account = queryKeys.account("profile");
    const organization = queryKeys.organization(
      "00000000-0000-4000-8000-000000000001",
      "leads",
      "open",
    );
    expect(isAuthenticatedQueryKey(account)).toBe(true);
    expect(isOrganizationQueryKey(organization)).toBe(true);
    expect(queryKeys.public("health")).toEqual(["public", "health"]);
  });
});
