const DEFAULT_APP_NAME = "Genesis Platform";
const DEFAULT_HTTP_TIMEOUT_MS = 10_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;

export const environment = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME?.trim() || DEFAULT_APP_NAME,
  apiBasePath: "/api/v1",
  httpTimeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
  rateLimitCooldownMs: DEFAULT_RATE_LIMIT_COOLDOWN_MS,
  tokenValidityMarginMs: 30_000,
  authCookieLockName: "genesis.auth-cookie.v1",
  sessionChannelName: "genesis.session.v1",
  activeOrganizationStorageKey: "genesis.activeOrganizationId.v1",
  csrfCookieNames: Object.freeze([
    "__Host-genesis_csrf",
    "genesis_csrf_dev",
  ] as const),
});
