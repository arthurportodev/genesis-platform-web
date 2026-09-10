import { HttpResponse, http } from "msw";

import type { Organization } from "@/features/auth/api/auth-contracts";

export const testUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Pessoa Teste",
  email: "pessoa@example.test",
  status: "active" as const,
};

export const testOrganizations: Organization[] = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Genesis Teste",
    slug: "genesis-teste",
    membershipId: "00000000-0000-4000-8000-000000000003",
    role: "owner",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Segunda Organização",
    slug: "segunda-organizacao",
    membershipId: "00000000-0000-4000-8000-000000000005",
    role: "member",
  },
];

const csrfToken = "a".repeat(43);
const fakeAccessToken = ["ey", "test", "access"].join(".");
export const testChallenge = {
  challengeId: "10000000-0000-4000-8000-000000000001",
  expiresAt: "2030-01-01T00:10:00.000Z",
  resendAvailableAt: "2000-01-01T00:00:00.000Z",
};

export function installWebLocks(): () => void {
  const original = navigator.locks;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock) => Promise<unknown>,
      ) => callback({ name: "genesis.auth-cookie.v1", mode: "exclusive" }),
    },
  });
  return () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: original,
    });
  };
}

export function createAuthHandlers(
  options: {
    organizations?: readonly Organization[];
    refreshStatus?: number;
    loginStatus?: number;
    loginVerificationRequired?: boolean;
    registerStatus?: number;
    passwordResetCompleteStatus?: number;
    delivery?: "sent" | "delivery_unavailable";
    onRefresh?: () => void;
  } = {},
) {
  const organizations = options.organizations ?? [testOrganizations[0]];
  const tokenResponse = {
    accessToken: fakeAccessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: testUser,
  };
  return [
    http.get("/api/v1/auth/google/config", () =>
      HttpResponse.json({ enabled: false, clientId: null }),
    ),
    http.get("/api/v1/auth/csrf", () => {
      document.cookie = `genesis_csrf_dev=${csrfToken}; Path=/; SameSite=Lax`;
      return HttpResponse.json(
        { csrfToken },
        { headers: { "Cache-Control": "no-store" } },
      );
    }),
    http.post("/api/v1/auth/login", async ({ request }) => {
      if (options.loginVerificationRequired) {
        return HttpResponse.json(
          {
            statusCode: 403,
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Email verification is required.",
            continuation: testChallenge,
          },
          { status: 403 },
        );
      }
      if (options.loginStatus && options.loginStatus !== 200) {
        return HttpResponse.json(
          {
            statusCode: options.loginStatus,
            message: "Invalid email or password.",
            error: "Unauthorized",
          },
          { status: options.loginStatus },
        );
      }
      const body = (await request.json()) as {
        email?: string;
        password?: string;
      };
      if (
        request.headers.get("x-csrf-token") !== csrfToken ||
        !body.email ||
        !body.password
      ) {
        return HttpResponse.json(
          { statusCode: 400, message: "Invalid request." },
          { status: 400 },
        );
      }
      return HttpResponse.json(tokenResponse);
    }),
    http.post("/api/v1/auth/register", async ({ request }) => {
      if (options.registerStatus && options.registerStatus !== 201) {
        return HttpResponse.json(
          {
            statusCode: options.registerStatus,
            code:
              options.registerStatus === 409
                ? "AUTH_EMAIL_ALREADY_REGISTERED"
                : "AUTH_REGISTRATION_UNAVAILABLE",
            message: "Registration unavailable.",
          },
          { status: options.registerStatus },
        );
      }
      const body = (await request.json()) as Record<string, unknown>;
      if (
        request.headers.get("x-csrf-token") !== csrfToken ||
        Object.keys(body).sort().join(",") !==
          "email,firstName,lastName,password"
      ) {
        return HttpResponse.json(
          { statusCode: 400, message: "Invalid request." },
          { status: 400 },
        );
      }
      return HttpResponse.json(
        {
          status: "verification_required",
          ...testChallenge,
          delivery: options.delivery ?? "sent",
        },
        { status: 201 },
      );
    }),
    http.post("/api/v1/auth/password-reset/request", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      if (
        request.headers.get("x-csrf-token") !== csrfToken ||
        Object.keys(body).join(",") !== "email"
      ) {
        return HttpResponse.json(
          { statusCode: 400, message: "Invalid request." },
          { status: 400 },
        );
      }
      return HttpResponse.json(
        {
          status: "accepted",
          expiresAt: "2030-01-01T00:10:00.000Z",
          resendAvailableAt: "2000-01-01T00:00:00.000Z",
        },
        { status: 202 },
      );
    }),
    http.post("/api/v1/auth/password-reset/complete", async ({ request }) => {
      const status = options.passwordResetCompleteStatus ?? 200;
      if (status !== 200) {
        return HttpResponse.json(
          {
            statusCode: status,
            code: "AUTH_PASSWORD_RESET_INVALID",
            message: "Invalid password reset.",
          },
          { status },
        );
      }
      const body = (await request.json()) as Record<string, unknown>;
      if (
        request.headers.get("x-csrf-token") !== csrfToken ||
        Object.keys(body).sort().join(",") !== "code,email,password"
      ) {
        return HttpResponse.json(
          { statusCode: 400, message: "Invalid request." },
          { status: 400 },
        );
      }
      return HttpResponse.json({ status: "password_reset" });
    }),
    http.post("/api/v1/auth/email-verification/resend", () =>
      HttpResponse.json({
        status: "verification_required",
        ...testChallenge,
        challengeId: "20000000-0000-4000-8000-000000000002",
        delivery: options.delivery ?? "sent",
      }),
    ),
    http.post("/api/v1/auth/email-verification/verify", async ({ request }) => {
      const body = (await request.json()) as { code?: string };
      if (body.code !== "123456") {
        return HttpResponse.json(
          {
            statusCode: 400,
            code: "AUTH_EMAIL_VERIFICATION_INVALID",
            message: "Invalid or expired verification code.",
          },
          { status: 400 },
        );
      }
      return HttpResponse.json({ status: "email_verified" });
    }),
    http.post("/api/v1/auth/refresh", ({ request }) => {
      options.onRefresh?.();
      const status = options.refreshStatus ?? 200;
      if (status !== 200) {
        return HttpResponse.json(
          { statusCode: status, message: "Invalid refresh token." },
          { status },
        );
      }
      if (request.headers.get("x-csrf-token") !== csrfToken) {
        return HttpResponse.json(
          { statusCode: 403, message: "CSRF validation failed." },
          { status: 403 },
        );
      }
      return HttpResponse.json(tokenResponse);
    }),
    http.get("/api/v1/auth/bootstrap", ({ request }) => {
      if (
        request.headers.get("authorization") !==
        `Bearer ${tokenResponse.accessToken}`
      ) {
        return HttpResponse.json(
          { statusCode: 401, message: "Unauthorized" },
          { status: 401 },
        );
      }
      return HttpResponse.json({ user: testUser, organizations });
    }),
    http.post("/api/v1/auth/logout", ({ request }) => {
      if (request.headers.has("authorization")) {
        return HttpResponse.json(
          { statusCode: 400, message: "Bearer is not allowed." },
          { status: 400 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/v1/auth/logout-all", ({ request }) => {
      if (!request.headers.has("authorization")) {
        return HttpResponse.json(
          { statusCode: 401, message: "Unauthorized" },
          { status: 401 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
