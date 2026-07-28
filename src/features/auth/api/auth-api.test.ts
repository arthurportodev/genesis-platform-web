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
  it("mantém os seis endpoints sem Organization e distingue Bearer", async () => {
    const calls: Array<{ path: string; options: HttpRequestOptions }> = [];
    const httpClient: BaseHttpClient = {
      request<T>(path: string, options: HttpRequestOptions = {}) {
        calls.push({ path, options });
        const data = path.endsWith("bootstrap")
          ? { user, organizations: [] }
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
