import {
  createAuthenticatedHttpClient,
  createBaseHttpClient,
  GENESIS_IF_MATCH_HEADER,
} from "@/shared/api/http-client";
import { AppError } from "@/shared/api/errors";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

describe("cliente HTTP base", () => {
  it("envia credentials e apenas headers solicitados", async () => {
    const fakeAccessToken = ["access", "memory", "only"].join("-");
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      jsonResponse(
        { ok: true },
        {
          headers: {
            "Content-Type": "application/json",
            ETag: '"revision-1"',
            Location: "/api/v1/resource/created",
          },
        },
      ),
    );
    const client = createBaseHttpClient({ fetch });

    const response = await client.request<{ ok: boolean }>("/api/v1/resource", {
      kind: "conditional-mutation",
      method: "POST",
      body: { name: "Teste" },
      accessToken: fakeAccessToken,
      organizationId: "00000000-0000-4000-8000-000000000001",
      ifMatch: '"revision-1"',
    });

    expect(response.etag).toBe('"revision-1"');
    expect(response.location).toBe("/api/v1/resource/created");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/resource",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({ name: "Teste" }),
      }),
    );
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${fakeAccessToken}`);
    expect(headers.get("X-Organization-Id")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(headers.get(GENESIS_IF_MATCH_HEADER)).toBe('"revision-1"');
    expect(headers.has("If-Match")).toBe(false);
  });

  it("transporta concorrência e idempotência em headers distintos", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(jsonResponse({ ok: true }));
    const client = createBaseHttpClient({ fetch });

    await client.request(
      "/api/v1/leads/00000000-0000-4000-8000-000000000001/move",
      {
        kind: "conditional-idempotent-mutation",
        method: "POST",
        body: { stage: "QUALIFIED" },
        accessToken: "synthetic-access-token",
        organizationId: "00000000-0000-4000-8000-000000000001",
        ifMatch: '"lead:00000000-0000-4000-8000-000000000001:7"',
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      },
    );

    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get(GENESIS_IF_MATCH_HEADER)).toBe(
      '"lead:00000000-0000-4000-8000-000000000001:7"',
    );
    expect(headers.has("If-Match")).toBe(false);
    expect(headers.get("Idempotency-Key")).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
  });

  it("retorna undefined em 204 e rejeita HTML ou paths absolutos", async () => {
    const noContent = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      createBaseHttpClient({ fetch: noContent }).request(
        "/api/v1/auth/logout",
        {
          method: "POST",
        },
      ),
    ).resolves.toMatchObject({ data: undefined, status: 204 });

    const html = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("<html>fallback</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    await expect(
      createBaseHttpClient({ fetch: html }).request("/api/v1/auth/bootstrap"),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      createBaseHttpClient({ fetch: html }).request(
        "https://api.example.test/api/v1/auth/bootstrap",
      ),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      createBaseHttpClient({ fetch: html }).request("/api/v1/../secret"),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      createBaseHttpClient({ fetch: html }).request("/api/v1/%2e%2e/secret"),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("limita JSON e aplica cooldown local após 429", async () => {
    const oversized = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        jsonResponse({ value: "x".repeat(20_000) }, { status: 400 }),
      );
    await expect(
      createBaseHttpClient({ fetch: oversized }).request("/api/v1/large"),
    ).rejects.toMatchObject({ kind: "protocol" });

    let now = 1_000;
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 429, message: "Too many requests" },
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = createBaseHttpClient({
      fetch,
      now: () => now,
      rateLimitCooldownMs: 30_000,
    });
    await expect(client.request("/api/v1/limited")).rejects.toMatchObject({
      kind: "rate-limited",
    });
    await expect(client.request("/api/v1/limited")).rejects.toMatchObject({
      kind: "rate-limited",
    });
    expect(fetch).toHaveBeenCalledOnce();
    now += 30_001;
    await expect(client.request("/api/v1/limited")).resolves.toMatchObject({
      data: { ok: true },
    });
  });

  it("arma cooldown antes de rejeitar body 429 malformado", async () => {
    const now = 1_000;
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("<html>limit</html>", {
        status: 429,
        headers: { "Content-Type": "text/html" },
      }),
    );
    const client = createBaseHttpClient({
      fetch,
      now: () => now,
      rateLimitCooldownMs: 30_000,
    });
    await expect(client.request("/api/v1/limited")).rejects.toMatchObject({
      kind: "protocol",
    });
    await expect(client.request("/api/v1/limited")).rejects.toMatchObject({
      kind: "rate-limited",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("distingue timeout de abort do caller", async () => {
    const pending = vi.fn<typeof globalThis.fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Abort", "AbortError")),
        );
      });
    });
    await expect(
      createBaseHttpClient({ fetch: pending, timeoutMs: 1 }).request(
        "/api/v1/slow",
      ),
    ).rejects.toMatchObject({ kind: "timeout" });

    const controller = new AbortController();
    controller.abort();
    await expect(
      createBaseHttpClient({ fetch: pending }).request("/api/v1/slow", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});

describe("cliente HTTP autenticado", () => {
  it("reusa token já atualizado por peer antes de solicitar refresh", async () => {
    let token = "old";
    const request = vi
      .fn()
      .mockImplementationOnce(() => {
        token = "new";
        return Promise.reject(new AppError("unauthorized", "unauthorized"));
      })
      .mockResolvedValueOnce({ data: { ok: true }, status: 200 });
    const refresh = vi.fn().mockResolvedValue(true);
    const client = createAuthenticatedHttpClient(
      { request },
      {
        getAccessToken: () => token,
        getActiveOrganizationId: () => null,
        refresh,
        expireSession: vi.fn(),
        rebootstrap: vi.fn(),
      },
    );
    await client.request("/api/v1/account", {
      kind: "authenticated",
      method: "GET",
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(request).toHaveBeenLastCalledWith(
      "/api/v1/account",
      expect.objectContaining({ accessToken: "new" }),
    );
  });

  it("não repete mutação sem prova ou chave de idempotência", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new AppError("unauthorized", "unauthorized"));
    const refresh = vi.fn().mockResolvedValue(true);
    const client = createAuthenticatedHttpClient(
      { request },
      {
        getAccessToken: () => "token",
        getActiveOrganizationId: () => "00000000-0000-4000-8000-000000000001",
        refresh,
        expireSession: vi.fn(),
        rebootstrap: vi.fn(),
      },
    );
    await expect(
      client.request("/api/v1/resource", {
        kind: "tenant-scoped",
        method: "POST",
        body: { value: true },
      }),
    ).rejects.toMatchObject({ kind: "unauthorized" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("preserva o forbidden e inicia rebootstrap fail-closed mesmo se ele falhar", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new AppError("forbidden", "Acesso revogado."));
    const rebootstrap = vi
      .fn()
      .mockRejectedValue(new AppError("network", "Sem conexão."));
    const client = createAuthenticatedHttpClient(
      { request },
      {
        getAccessToken: () => "token",
        getActiveOrganizationId: () => "00000000-0000-4000-8000-000000000001",
        refresh: vi.fn(),
        expireSession: vi.fn(),
        rebootstrap,
      },
    );

    await expect(
      client.request("/api/v1/leads/metrics/summary", {
        kind: "tenant-scoped",
        method: "GET",
      }),
    ).rejects.toMatchObject({ kind: "forbidden" });
    expect(rebootstrap).toHaveBeenCalledOnce();
  });

  it("exige If-Match e Idempotency-Key no modo combinado", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createBaseHttpClient({ fetch });
    const base = {
      kind: "conditional-idempotent-mutation" as const,
      method: "POST" as const,
      accessToken: ["memory", "token"].join("-"),
      organizationId: "00000000-0000-4000-8000-000000000001",
    };
    await expect(
      client.request("/api/v1/leads/command", {
        ...base,
        ifMatch: '"opaque"',
      }),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      client.request("/api/v1/leads/command", {
        ...base,
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      client.request("/api/v1/leads/command", {
        ...base,
        ifMatch: "*",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }),
    ).rejects.toMatchObject({ kind: "protocol" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserva os headers combinados no replay autenticado", async () => {
    let token = "old";
    const request = vi
      .fn()
      .mockRejectedValueOnce(new AppError("unauthorized", "unauthorized"))
      .mockResolvedValueOnce({ data: undefined, status: 204 });
    const client = createAuthenticatedHttpClient(
      { request },
      {
        getAccessToken: () => token,
        getActiveOrganizationId: () => "00000000-0000-4000-8000-000000000001",
        refresh: vi.fn(() => {
          token = "new";
          return Promise.resolve(true);
        }),
        expireSession: vi.fn(),
        rebootstrap: vi.fn(),
      },
    );
    const options = {
      kind: "conditional-idempotent-mutation" as const,
      method: "POST" as const,
      ifMatch: '"opaque"',
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    };
    await client.request("/api/v1/leads/command", options);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).toEqual(
      expect.objectContaining({ ...options, accessToken: "new" }),
    );
  });
});
