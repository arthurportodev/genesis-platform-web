import { describe, expect, it, vi } from "vitest";
import {
  createBaseHttpClient,
  GENESIS_IF_MATCH_HEADER,
} from "@/shared/api/http-client";
import { handleApiProxy, type ProxyEnvironment } from "./api-proxy";

const environment: ProxyEnvironment = {
  VERCEL_ENV: "production",
  GENESIS_API_PROXY_TARGET: "https://api.agenciagenesismkt.com.br",
  GENESIS_ORIGIN_KEY: "A".repeat(43),
};

function throughProductionProxy(upstream: typeof globalThis.fetch) {
  return vi.fn<typeof globalThis.fetch>((input, init) => {
    const path = typeof input === "string" ? input : new Request(input).url;
    const publicUrl = new URL(path, "https://app.agenciagenesismkt.com.br");
    const capture = publicUrl.pathname.slice("/api/v1/".length);
    publicUrl.searchParams.append("__genesis_proxy_path", capture);
    const headers = new Headers(init?.headers);
    expect(headers.get(GENESIS_IF_MATCH_HEADER)).not.toBeNull();
    expect(headers.has("If-Match")).toBe(false);
    headers.set("host", "app.agenciagenesismkt.com.br");
    headers.set("x-forwarded-host", "app.agenciagenesismkt.com.br");
    headers.set("x-forwarded-proto", "https");
    headers.set("x-vercel-forwarded-for", "203.0.113.9");
    return handleApiProxy(
      new Request(publicUrl, { ...init, headers }),
      environment,
      { fetch: upstream },
    );
  });
}

describe("If-Match browser-to-API transport", () => {
  const leadId = "00000000-0000-4000-8000-000000000001";

  it("sends only the private header from the browser and one If-Match upstream", async () => {
    const upstream = vi.fn<typeof globalThis.fetch>((_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("If-Match")).toBe(`"lead:${leadId}:7"`);
      expect(headers.has(GENESIS_IF_MATCH_HEADER)).toBe(false);
      expect(headers.get("Idempotency-Key")).toBe(
        "00000000-0000-4000-8000-000000000002",
      );
      return Promise.resolve(
        Response.json(
          { ok: true },
          { status: 200, headers: { ETag: `"lead:${leadId}:8"` } },
        ),
      );
    });
    const client = createBaseHttpClient({
      fetch: throughProductionProxy(upstream),
    });

    const response = await client.request<{ ok: boolean }>(
      `/api/v1/leads/${leadId}/move`,
      {
        kind: "conditional-idempotent-mutation",
        method: "POST",
        body: { stage: "QUALIFIED" },
        ifMatch: `"lead:${leadId}:7"`,
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      },
    );

    expect(response).toMatchObject({
      status: 200,
      etag: `"lead:${leadId}:8"`,
      data: { ok: true },
    });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("keeps stale concurrency semantics as HTTP 412", async () => {
    const upstream = vi.fn<typeof globalThis.fetch>((_input, init) => {
      expect(new Headers(init?.headers).get("If-Match")).toBe(
        `"lead:${leadId}:6"`,
      );
      return Promise.resolve(
        Response.json(
          { statusCode: 412, message: "Precondition failed" },
          { status: 412, headers: { ETag: `"lead:${leadId}:7"` } },
        ),
      );
    });
    const client = createBaseHttpClient({
      fetch: throughProductionProxy(upstream),
    });

    await expect(
      client.request(`/api/v1/leads/${leadId}`, {
        kind: "conditional-mutation",
        method: "PATCH",
        body: { name: "stale" },
        ifMatch: `"lead:${leadId}:6"`,
      }),
    ).rejects.toMatchObject({ kind: "precondition-failed", status: 412 });
    expect(upstream).toHaveBeenCalledOnce();
  });
});
