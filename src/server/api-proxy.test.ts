import { describe, expect, it, vi } from "vitest";
import {
  canonicalizeVercelClientIp,
  handleApiProxy,
  resolvePublicApiUrl,
  rewriteSafeLocation,
  type ProxyEnvironment,
} from "./api-proxy";

const environment: ProxyEnvironment = {
  VERCEL_ENV: "production",
  GENESIS_API_PROXY_TARGET: "https://api.agenciagenesismkt.com.br",
  GENESIS_ORIGIN_KEY: "A".repeat(43),
};

function productionRequest(path: string, init: RequestInit = {}): Request {
  const requestUrl = new URL(`https://app.agenciagenesismkt.com.br${path}`);
  if (
    (requestUrl.pathname === "/api/v1" ||
      requestUrl.pathname.startsWith("/api/v1/")) &&
    !requestUrl.searchParams.has("__genesis_proxy_path")
  ) {
    const capture =
      requestUrl.pathname === "/api/v1"
        ? ""
        : requestUrl.pathname.slice("/api/v1/".length);
    requestUrl.search += `${requestUrl.search ? "&" : "?"}__genesis_proxy_path=${encodeURIComponent(capture)}`;
  }
  const headers = new Headers(init.headers);
  if (!headers.has("host")) {
    headers.set("host", "app.agenciagenesismkt.com.br");
  }
  if (!headers.has("x-forwarded-host")) {
    headers.set("x-forwarded-host", "app.agenciagenesismkt.com.br");
  }
  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", "https");
  }
  if (!headers.has("x-vercel-forwarded-for")) {
    headers.set("x-vercel-forwarded-for", "203.0.113.9");
  }
  return new Request(requestUrl, {
    ...init,
    headers,
  });
}

describe("Vercel same-origin API proxy", () => {
  it("accepts only the cloud-observed public path with a matching router capture", () => {
    expect(
      resolvePublicApiUrl(
        new URL(
          "https://app.agenciagenesismkt.com.br/api/v1/leads/synthetic?__genesis_proxy_path=leads%2Fsynthetic&q=one&q=two",
        ),
      )?.href,
    ).toBe(
      "https://app.agenciagenesismkt.com.br/api/v1/leads/synthetic?q=one&q=two",
    );
    expect(
      resolvePublicApiUrl(
        new URL(
          "https://app.agenciagenesismkt.com.br/api/v1?__genesis_proxy_path=",
        ),
      )?.pathname,
    ).toBe("/api/v1");
    expect(
      resolvePublicApiUrl(
        new URL(
          "https://app.agenciagenesismkt.com.br/api/v1/leads?q=synthetic",
        ),
      ),
    ).toBeNull();
  });

  it("reproduces the legacy C3 predicate and fixes that exact router shape", async () => {
    const requestUrl = new URL(
      "https://app.agenciagenesismkt.com.br/api/v1/auth/csrf?__genesis_proxy_path=auth%2Fcsrf&synthetic=1",
    );
    const legacyWouldResolvePublicPath =
      requestUrl.pathname.startsWith("/api/v1/") &&
      requestUrl.searchParams.getAll("__genesis_proxy_path").length === 0;
    expect(legacyWouldResolvePublicPath).toBe(false);

    const fetch = vi.fn((input: URL | RequestInfo) => {
      const target =
        input instanceof URL
          ? input.href
          : typeof input === "string"
            ? input
            : input.url;
      expect(target).toBe(
        "https://api.agenciagenesismkt.com.br/api/v1/auth/csrf?synthetic=1",
      );
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const log = vi.fn();
    const response = await handleApiProxy(
      new Request(requestUrl, {
        headers: {
          host: "app.agenciagenesismkt.com.br",
          "x-forwarded-host": "app.agenciagenesismkt.com.br",
          "x-forwarded-proto": "https",
          "x-vercel-deployment-url":
            "genesis-platform-synthetic-arthur433.vercel.app",
          "x-vercel-forwarded-for": "203.0.113.9",
        },
      }),
      environment,
      { fetch, log },
    );

    expect(response.status).toBe(204);
    expect(fetch).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    "/api/proxy",
    "/api/proxy?__genesis_proxy_path=one&__genesis_proxy_path=two",
    "/api/proxy?__genesis_proxy_path=%2Foutside",
    "/api/proxy?__genesis_proxy_path=..%2Foutside",
    "/api/v1/leads",
    "/api/v1/leads?__genesis_proxy_path=leads&__genesis_proxy_path=leads",
    "/api/v1/leads?__genesis_proxy_path=%E0%A4%A",
    "/api/v1/leads?__genesis_proxy_path=forged",
    "/api/v1/auth/csrf?__genesis_proxy_path=auth%2Fbootstrap",
    "/api/v1/auth/csrf?__genesis_proxy_path=%2Fauth%2Fcsrf",
    "/api/v10/leads",
  ])("rejects forged or out-of-scope rewrite state %s", (path) => {
    expect(
      resolvePublicApiUrl(
        new URL(`https://app.agenciagenesismkt.com.br${path}`),
      ),
    ).toBeNull();
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "preserves %s, public path and query after Vercel's rewrite",
    async (method) => {
      const fetch = vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
        const target =
          input instanceof URL
            ? input.href
            : typeof input === "string"
              ? input
              : input.url;
        expect(target).toBe(
          "https://api.agenciagenesismkt.com.br/api/v1/leads/synthetic?q=one&q=two",
        );
        expect(init?.method).toBe(method);
        return Promise.resolve(new Response(null, { status: 204 }));
      });
      const response = await handleApiProxy(
        new Request(
          "https://genesis-platform-c2.vercel.app/api/v1/leads/synthetic?__genesis_proxy_path=leads%2Fsynthetic&q=one&q=two",
          {
            method,
            headers: {
              host: "app.agenciagenesismkt.com.br",
              "x-forwarded-host": "app.agenciagenesismkt.com.br",
              "x-forwarded-proto": "https",
              "x-vercel-forwarded-for": "203.0.113.9",
            },
          },
        ),
        environment,
        { fetch },
      );
      expect(response.status).toBe(204);
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("fails closed for Preview, generated hosts, non-API paths and incomplete configuration", async () => {
    const fetch = vi.fn();
    const cases: Array<[Request, ProxyEnvironment, number]> = [
      [
        productionRequest("/api/v1/auth/bootstrap"),
        { ...environment, VERCEL_ENV: "preview" },
        404,
      ],
      [
        new Request("https://candidate.vercel.app/api/v1/auth/bootstrap", {
          headers: {
            host: "candidate.vercel.app",
            "x-forwarded-host": "app.agenciagenesismkt.com.br",
            "x-forwarded-proto": "https",
            "x-vercel-forwarded-for": "203.0.113.9",
          },
        }),
        environment,
        404,
      ],
      [
        new Request(
          "https://candidate.vercel.app/api/v1/auth/bootstrap?__genesis_proxy_path=auth%2Fbootstrap",
          {
            headers: {
              host: "app.agenciagenesismkt.com.br",
              "x-forwarded-host": "candidate.vercel.app",
              "x-forwarded-proto": "https",
              "x-vercel-forwarded-for": "203.0.113.9",
            },
          },
        ),
        environment,
        404,
      ],
      [
        new Request(
          "https://candidate.vercel.app/api/v1/auth/bootstrap?__genesis_proxy_path=auth%2Fbootstrap",
          {
            headers: {
              host: "app.agenciagenesismkt.com.br",
              "x-forwarded-host": "app.agenciagenesismkt.com.br",
              "x-forwarded-proto": "http",
              "x-vercel-forwarded-for": "203.0.113.9",
            },
          },
        ),
        environment,
        404,
      ],
      [
        new Request(
          "https://app.agenciagenesismkt.com.br/api/v1/auth/bootstrap",
          {
            headers: { "x-vercel-forwarded-for": "203.0.113.9" },
          },
        ),
        environment,
        404,
      ],
      [
        productionRequest("/api/v1/auth/bootstrap", {
          headers: {
            host: "app.agenciagenesismkt.com.br, candidate.vercel.app",
          },
        }),
        environment,
        404,
      ],
      [
        productionRequest("/api/v1/auth/bootstrap", {
          headers: {
            "x-forwarded-host":
              "app.agenciagenesismkt.com.br, candidate.vercel.app",
          },
        }),
        environment,
        404,
      ],
      [
        productionRequest("/api/v1/auth/bootstrap", {
          headers: { "x-forwarded-proto": "https, http" },
        }),
        environment,
        404,
      ],
      [
        productionRequest("/api/v1/auth/bootstrap", {
          headers: { host: "app.agenciagenesismkt.com.br:443" },
        }),
        environment,
        404,
      ],
      [productionRequest("/dashboard"), environment, 404],
      [
        productionRequest("/api/v1/auth/bootstrap"),
        { ...environment, GENESIS_ORIGIN_KEY: undefined },
        503,
      ],
    ];
    for (const [request, candidateEnvironment, status] of cases) {
      const response = await handleApiProxy(request, candidateEnvironment, {
        fetch,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("emits one enum-and-boolean event without sensitive request data", async () => {
    const log = vi.fn();
    const fetch = vi.fn();
    const response = await handleApiProxy(
      new Request(
        "https://candidate.vercel.app/api/v1/auth/csrf?__genesis_proxy_path=auth%2Fcsrf&query-secret-marker=never-log",
        {
          headers: {
            authorization: "Bearer synthetic-token-marker",
            cookie: "session=synthetic-cookie-marker",
            host: "candidate.vercel.app",
            "x-forwarded-host": "candidate.vercel.app",
            "x-forwarded-proto": "https",
            "x-vercel-deployment-url": "candidate.vercel.app",
            "x-vercel-forwarded-for": "198.51.100.77",
          },
        },
      ),
      {
        VERCEL_ENV: "preview",
        GENESIS_API_PROXY_TARGET: "https://api.agenciagenesismkt.com.br",
        GENESIS_ORIGIN_KEY: "origin-key-marker".repeat(4),
      },
      { fetch, log },
    );

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(log.mock.calls);
    for (const forbidden of [
      "never-log",
      "query-secret-marker",
      "synthetic-token-marker",
      "synthetic-cookie-marker",
      "198.51.100.77",
      "origin-key-marker",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("preserves method, query, body, Origin and CSRF while overwriting spoofable headers", async () => {
    const fetch = vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
      const target =
        input instanceof URL
          ? input.href
          : typeof input === "string"
            ? input
            : input.url;
      expect(target).toBe(
        "https://api.agenciagenesismkt.com.br/api/v1/leads?q=sintetico",
      );
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("manual");
      expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe(
        '{"name":"Synthetic"}',
      );
      const headers = new Headers(init?.headers);
      expect(headers.get("origin")).toBe(
        "https://app.agenciagenesismkt.com.br",
      );
      expect(headers.get("x-csrf-token")).toBe("csrf-synthetic");
      expect(headers.get("cookie")).toBe("__Host-genesis_csrf=synthetic");
      expect(headers.get("x-forwarded-for")).toBeNull();
      expect(headers.get("x-real-ip")).toBeNull();
      expect(headers.get("cf-connecting-ip")).toBeNull();
      expect(headers.get("true-client-ip")).toBeNull();
      expect(headers.get("fastly-client-ip")).toBeNull();
      expect(headers.get("fly-client-ip")).toBeNull();
      expect(headers.get("x-client-ip")).toBeNull();
      expect(headers.get("x-envoy-external-address")).toBeNull();
      expect(headers.get("x-client-internal")).toBeNull();
      expect(headers.get("x-genesis-origin-key")).toBe("A".repeat(43));
      expect(headers.get("x-genesis-client-ip")).toBe("203.0.113.9");
      expect(headers.get("accept-encoding")).toBe("identity");
      return Promise.resolve(Response.json({ ok: true }, { status: 201 }));
    });
    const response = await handleApiProxy(
      productionRequest("/api/v1/leads?q=sintetico", {
        method: "POST",
        headers: {
          Origin: "https://app.agenciagenesismkt.com.br",
          Cookie: "__Host-genesis_csrf=synthetic",
          "X-CSRF-Token": "csrf-synthetic",
          "X-Forwarded-For": "198.51.100.77",
          "X-Real-IP": "198.51.100.78",
          "CF-Connecting-IP": "198.51.100.80",
          "True-Client-IP": "198.51.100.81",
          "Fastly-Client-IP": "198.51.100.82",
          "Fly-Client-IP": "198.51.100.83",
          "X-Client-IP": "198.51.100.84",
          "X-Envoy-External-Address": "198.51.100.85",
          "X-Genesis-Origin-Key": "client-forgery",
          "X-Genesis-Client-IP": "198.51.100.79",
          Connection: "X-Client-Internal, keep-alive",
          "X-Client-Internal": "must-be-removed",
        },
        body: JSON.stringify({ name: "Synthetic" }),
      }),
      environment,
      { fetch },
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves separate secure host-only cookies and contractual headers", async () => {
    const upstreamHeaders = new Headers({
      ETag: '"synthetic-etag"',
      Location:
        "https://api.agenciagenesismkt.com.br/api/v1/leads/synthetic?from=create",
      "Retry-After": "60",
      "RateLimit-Limit": "25",
    });
    upstreamHeaders.append(
      "Set-Cookie",
      "__Host-genesis_refresh=synthetic-one; Path=/; Secure; HttpOnly; SameSite=Lax",
    );
    upstreamHeaders.append(
      "Set-Cookie",
      "__Host-genesis_csrf=synthetic-two; Path=/; Secure; SameSite=Lax",
    );
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/login", { method: "POST", body: "{}" }),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            Response.json(
              { accessToken: "synthetic" },
              { status: 201, headers: upstreamHeaders },
            ),
          ),
        ),
      },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(
      "/api/v1/leads/synthetic?from=create",
    );
    expect(response.headers.get("etag")).toBe('"synthetic-etag"');
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit-limit")).toBe("25");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([
      "__Host-genesis_refresh=synthetic-one; Path=/; Secure; HttpOnly; SameSite=Lax",
      "__Host-genesis_csrf=synthetic-two; Path=/; Secure; SameSite=Lax",
    ]);
  });

  it.each([
    "https://evil.example/api/v1/leads/1",
    "//api.agenciagenesismkt.com.br/api/v1/leads/1",
    "https://api.agenciagenesismkt.com.br/dashboard",
    "/outside/api/v1",
    "relative/path",
  ])("rejects unsafe Location %s without exposing it", async (location) => {
    const response = await handleApiProxy(
      productionRequest("/api/v1/leads"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response(null, {
              status: 302,
              headers: { Location: location },
            }),
          ),
        ),
      },
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("removes fixed and Connection-nominated hop-by-hop response headers", async () => {
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response('{"ok":true}', {
              headers: {
                "Content-Type": "application/json",
                Connection: "X-Upstream-Internal, Keep-Alive",
                "Keep-Alive": "timeout=5",
                "X-Upstream-Internal": "remove-me",
              },
            }),
          ),
        ),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("connection")).toBeNull();
    expect(response.headers.get("keep-alive")).toBeNull();
    expect(response.headers.get("x-upstream-internal")).toBeNull();
  });

  it("fails closed when Connection nominates separately handled Set-Cookie", async () => {
    const upstreamHeaders = new Headers({ Connection: "Set-Cookie" });
    upstreamHeaders.append(
      "Set-Cookie",
      "__Host-genesis_csrf=synthetic; Path=/; Secure; SameSite=Lax",
    );
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/csrf"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(new Response("{}", { headers: upstreamHeaders })),
        ),
      },
    );
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("removes fixed and Connection-nominated request headers", async () => {
    const fetch = vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      for (const name of [
        "connection",
        "keep-alive",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "x-client-hop",
      ]) {
        expect(headers.get(name), name).toBeNull();
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const response = await handleApiProxy(
      productionRequest("/api/v1/leads/synthetic", {
        method: "DELETE",
        headers: {
          Connection: "X-Client-Hop, Keep-Alive",
          "Keep-Alive": "timeout=5",
          "Proxy-Authorization": "synthetic",
          TE: "trailers",
          Trailer: "X-Later",
          Upgrade: "websocket",
          "X-Client-Hop": "remove-me",
        },
      }),
      environment,
      { fetch },
    );
    expect(response.status).toBe(204);
  });

  it("removes upstream cache metadata and never reports a CDN hit", async () => {
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response("synthetic", {
              headers: {
                Age: "600",
                "Cache-Control": "public, max-age=600",
                "CDN-Cache-Control": "public, max-age=600",
                "Surrogate-Control": "max-age=600",
                "Vercel-CDN-Cache-Control": "public, max-age=600",
                "X-Vercel-Cache": "HIT",
              },
            }),
          ),
        ),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("age")).toBeNull();
    expect(response.headers.get("surrogate-control")).toBeNull();
    expect(response.headers.get("x-vercel-cache")).toBeNull();
  });

  it.each([
    ["HEAD", 200],
    ["GET", 204],
    ["GET", 304],
  ])("returns no body for %s/%i", async (method, status) => {
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap", { method }),
      environment,
      {
        fetch: vi.fn(() => Promise.resolve(new Response(null, { status }))),
      },
    );
    expect(response.status).toBe(status);
    expect(await response.text()).toBe("");
  });

  it("rejects malformed Connection tokens, non-canonical IP and unsafe cookies", async () => {
    const invalidConnection = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap", {
        headers: { Connection: "valid, invalid token" },
      }),
      environment,
      { fetch: vi.fn() },
    );
    expect(invalidConnection.status).toBe(400);

    const invalidIp = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap", {
        headers: { "x-vercel-forwarded-for": "203.0.113.9, 198.51.100.1" },
      }),
      environment,
      { fetch: vi.fn() },
    );
    expect(invalidIp.status).toBe(400);

    const unsafeCookie = await handleApiProxy(
      productionRequest("/api/v1/auth/csrf"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response("{}", {
              headers: {
                "Set-Cookie":
                  "genesis=synthetic; Domain=api.agenciagenesismkt.com.br; Path=/; Secure",
              },
            }),
          ),
        ),
      },
    );
    expect(unsafeCookie.status).toBe(502);
    expect(unsafeCookie.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed for invalid lengths, read errors and encoded path traversal", async () => {
    const invalidRequestLength = await handleApiProxy(
      productionRequest("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Length": "1, 2" },
        body: "{}",
      }),
      environment,
      { fetch: vi.fn() },
    );
    expect(invalidRequestLength.status).toBe(400);

    const oversizedRequest = await handleApiProxy(
      productionRequest("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Length": "4500001" },
        body: "{}",
      }),
      environment,
      { fetch: vi.fn() },
    );
    expect(oversizedRequest.status).toBe(413);

    const oversizedResponse = await handleApiProxy(
      productionRequest("/api/v1/leads"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response(null, { headers: { "Content-Length": "4500001" } }),
          ),
        ),
      },
    );
    expect(oversizedResponse.status).toBe(502);

    const brokenBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("synthetic read failure"));
      },
    });
    const brokenResponse = await handleApiProxy(
      productionRequest("/api/v1/leads"),
      environment,
      { fetch: vi.fn(() => Promise.resolve(new Response(brokenBody))) },
    );
    expect(brokenResponse.status).toBe(502);

    const traversal = await handleApiProxy(
      productionRequest("/api/v1/%2e%2e/%2e%2e/outside"),
      environment,
      { fetch: vi.fn() },
    );
    expect(traversal.status).toBe(404);
  });

  it("fails closed for encoded upstream bodies and internal response headers", async () => {
    const response = await handleApiProxy(
      productionRequest("/api/v1/auth/bootstrap"),
      environment,
      {
        fetch: vi.fn(() =>
          Promise.resolve(
            new Response("synthetic", {
              headers: {
                "Content-Encoding": "gzip",
                "X-Genesis-Origin-Key": "must-not-escape",
                "X-Genesis-Proxy-Attested": "v1",
              },
            }),
          ),
        ),
      },
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("x-genesis-origin-key")).toBeNull();
    expect(response.headers.get("x-genesis-proxy-attested")).toBeNull();
  });

  it.each([
    ["203.0.113.9", "203.0.113.9"],
    ["2001:0db8:0:0:0:0:0:1", "2001:db8::1"],
    ["::ffff:192.0.2.1", "::ffff:192.0.2.1"],
    ["203.0.113.9, 198.51.100.1", null],
    ["203.000.113.9", null],
  ])("canonicalizes trusted Vercel IP %s", (input, expected) => {
    expect(canonicalizeVercelClientIp(input)).toBe(expected);
  });

  it.each([
    ["/api/v1/leads/1", "/api/v1/leads/1"],
    [
      "https://api.agenciagenesismkt.com.br/api/v1/leads/1#created",
      "/api/v1/leads/1#created",
    ],
    ["https://evil.example/api/v1/leads/1", null],
  ])("rewrites safe Location %s", (input, expected) => {
    expect(rewriteSafeLocation(input)).toBe(expected);
  });
});
