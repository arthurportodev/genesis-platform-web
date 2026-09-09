import { createAuthApi } from "@/features/auth/api/auth-api";
import type {
  BaseHttpClient,
  HttpRequestOptions,
} from "@/shared/api/contracts";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Pessoa Teste",
  email: "pessoa@example.test",
  status: "active" as const,
};
const fakeAccessToken = ["access", "token"].join("-");
const tokenResponse = {
  accessToken: fakeAccessToken,
  tokenType: "Bearer" as const,
  expiresIn: 900,
  user,
};

describe("AuthApi", () => {
  it("mantém os endpoints de autenticação sem Organization e distingue Bearer", async () => {
    const calls: Array<{ path: string; options: HttpRequestOptions }> = [];
    const httpClient: BaseHttpClient = {
      request<T>(path: string, options: HttpRequestOptions = {}) {
        calls.push({ path, options });
        const data = path.endsWith("bootstrap")
          ? { user, organizations: [] }
          : path.endsWith("password-reset/request")
            ? {
                status: "accepted",
                expiresAt: "2030-01-01T00:10:00.000Z",
                resendAvailableAt: "2030-01-01T00:01:00.000Z",
              }
            : path.endsWith("password-reset/complete")
              ? { status: "password_reset" }
              : path.endsWith("register") || path.endsWith("resend")
                ? {
                    status: "verification_required",
                    challengeId: "10000000-0000-4000-8000-000000000001",
                    expiresAt: "2030-01-01T00:10:00.000Z",
                    resendAvailableAt: "2030-01-01T00:01:00.000Z",
                    delivery: "sent",
                  }
                : path.endsWith("verify")
                  ? { status: "email_verified" }
                  : path.endsWith("logout") || path.endsWith("logout-all")
                    ? undefined
                    : tokenResponse;
        return Promise.resolve({
          data: data as T,
          status:
            path.endsWith("logout") || path.endsWith("logout-all") ? 204 : 200,
        });
      },
    };
    const api = createAuthApi(httpClient, {
      getToken: vi.fn().mockResolvedValue("a".repeat(43)),
      invalidate: vi.fn(),
    });

    await api.login({ email: user.email, password: "not-a-real-secret" });
    await api.requestPasswordReset({ email: user.email });
    await api.completePasswordReset({
      email: user.email,
      code: "123456",
      password: "new-not-a-real-secret",
    });
    await api.register({
      firstName: "Pessoa",
      lastName: "Teste",
      email: user.email,
      password: "not-a-real-secret",
    });
    await api.resendEmailVerification({
      challengeId: "10000000-0000-4000-8000-000000000001",
    });
    await api.verifyEmail({
      challengeId: "10000000-0000-4000-8000-000000000001",
      code: "123456",
    });
    await api.refresh();
    await api.logout();
    await api.logoutAll("memory-access");
    await api.bootstrap("memory-access");

    for (const { options } of calls) {
      expect(options.organizationId).toBeUndefined();
    }
    const logoutOptions = calls.find(({ path }) =>
      path.endsWith("/logout"),
    )?.options;
    const logoutAllOptions = calls.find(({ path }) =>
      path.endsWith("/logout-all"),
    )?.options;
    expect(logoutOptions?.accessToken).toBeUndefined();
    expect(logoutAllOptions?.accessToken).toBe("memory-access");
  });

  it("rejeita campos adicionais no contexto público de verificação", async () => {
    const httpClient: BaseHttpClient = {
      request: vi.fn().mockResolvedValue({
        data: {
          status: "verification_required",
          challengeId: "10000000-0000-4000-8000-000000000001",
          expiresAt: "2030-01-01T00:10:00.000Z",
          resendAvailableAt: "2030-01-01T00:01:00.000Z",
          delivery: "sent",
          email: "must-not-cross-boundary@example.test",
        },
        status: 201,
      }),
    };
    const api = createAuthApi(httpClient, {
      getToken: vi.fn().mockResolvedValue("a".repeat(43)),
      invalidate: vi.fn(),
    });
    await expect(
      api.register({
        firstName: "Pessoa",
        lastName: "Teste",
        email: user.email,
        password: "senha-fictícia",
      }),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("rejeita campos de credencial não previstos na resposta", async () => {
    const httpClient: BaseHttpClient = {
      request: vi.fn().mockResolvedValue({
        data: { ...tokenResponse, refreshToken: "não-aceito" },
        status: 200,
      }),
    };
    const api = createAuthApi(httpClient, {
      getToken: vi.fn().mockResolvedValue("a".repeat(43)),
      invalidate: vi.fn(),
    });
    await expect(
      api.login({ email: user.email, password: "senha-fictícia" }),
    ).rejects.toMatchObject({ kind: "protocol" });
  });
});
