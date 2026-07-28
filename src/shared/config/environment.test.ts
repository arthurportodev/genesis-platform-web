import { environment } from "@/shared/config/environment";

describe("environment", () => {
  it("expõe configuração pública tipada, estável e sem segredos", () => {
    expect(environment).toEqual({
      appName: "Genesis Platform",
      apiBasePath: "/api/v1",
      httpTimeoutMs: 10_000,
      rateLimitCooldownMs: 30_000,
      tokenValidityMarginMs: 30_000,
      authCookieLockName: "genesis.auth-cookie.v1",
      sessionChannelName: "genesis.session.v1",
      activeOrganizationStorageKey: "genesis.activeOrganizationId.v1",
      csrfCookieNames: ["__Host-genesis_csrf", "genesis_csrf_dev"],
    });
    expect(Object.isFrozen(environment)).toBe(true);
    expect(JSON.stringify(environment)).not.toMatch(
      /password|secret|access.?token/iu,
    );
  });
});
