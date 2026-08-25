import {
  createServer as createHttpServer,
  type IncomingHttpHeaders,
  type Server,
} from "node:http";
import { request as nodeRequest } from "node:http";
import path from "node:path";

import { createServer as createViteServer, type ViteDevServer } from "vite";

import {
  createBaseHttpClient,
  GENESIS_IF_MATCH_HEADER,
} from "@/shared/api/http-client";
import { server as mockServiceWorkerServer } from "@/test/msw/server";

interface UpstreamCall {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
}

const host = "127.0.0.1";
const leadId = "00000000-0000-4000-8000-000000000001";
const calls: UpstreamCall[] = [];
let upstream: Server;
let vite: ViteDevServer;
let viteOrigin: string;
let previousTarget: string | undefined;

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server address unavailable."));
        return;
      }
      resolve(address.port);
    });
  });
}

async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function nodeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers));
    const request = nodeRequest(
      input,
      { method: init.method ?? "GET", headers },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode,
              statusText: response.statusMessage,
              headers: response.headers as HeadersInit,
            }),
          );
        });
      },
    );
    request.once("error", reject);
    if (init.signal) {
      if (init.signal.aborted) request.destroy(new Error("Request aborted."));
      else
        init.signal.addEventListener(
          "abort",
          () => request.destroy(new Error("Request aborted.")),
          { once: true },
        );
    }
    if (typeof init.body === "string" || init.body instanceof Uint8Array) {
      request.write(init.body);
    } else if (init.body instanceof ArrayBuffer) {
      request.write(new Uint8Array(init.body));
    }
    request.end();
  });
}

function absoluteFetch(origin: string): typeof globalThis.fetch {
  return (input, init) => {
    const target =
      typeof input === "string"
        ? new URL(input, origin)
        : new Request(input).url;
    return nodeFetch(target.toString(), init);
  };
}

beforeAll(async () => {
  mockServiceWorkerServer.close();
  previousTarget = process.env.GENESIS_API_PROXY_TARGET;
  upstream = createHttpServer((request, response) => {
    calls.push({
      method: request.method,
      url: request.url,
      headers: { ...request.headers },
    });
    request.resume();
    request.once("end", () => {
      const stale = request.headers["if-match"]?.endsWith(':6"') === true;
      const status = stale ? 412 : 200;
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ETag: `"lead:${leadId}:${stale ? 7 : 8}"`,
      });
      response.end(
        JSON.stringify(
          stale
            ? { statusCode: 412, message: "Precondition failed" }
            : { ok: true },
        ),
      );
    });
  });
  const upstreamPort = await listen(upstream);
  process.env.GENESIS_API_PROXY_TARGET = `http://${host}:${upstreamPort}`;

  vite = await createViteServer({
    root: process.cwd(),
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    logLevel: "silent",
    server: { host, port: 0, strictPort: false },
  });
  await vite.listen();
  const address = vite.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Vite test server address unavailable.");
  }
  viteOrigin = `http://${host}:${address.port}`;
});

afterAll(async () => {
  await vite.close();
  await closeHttpServer(upstream);
  if (previousTarget === undefined) delete process.env.GENESIS_API_PROXY_TARGET;
  else process.env.GENESIS_API_PROXY_TARGET = previousTarget;
});

beforeEach(() => calls.splice(0));

describe("configured Vite If-Match proxy boundary", () => {
  it("translates conditional PATCH and preserves 200 plus ETag", async () => {
    const client = createBaseHttpClient({ fetch: absoluteFetch(viteOrigin) });
    const response = await client.request<{ ok: boolean }>(
      `/api/v1/leads/${leadId}`,
      {
        kind: "conditional-mutation",
        method: "PATCH",
        body: { name: "updated" },
        ifMatch: `"lead:${leadId}:7"`,
      },
    );

    expect(response).toMatchObject({ status: 200, etag: `"lead:${leadId}:8"` });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["if-match"]).toBe(`"lead:${leadId}:7"`);
    expect(calls[0]?.headers["x-genesis-if-match"]).toBeUndefined();
  });

  it("preserves conditional idempotency through the local proxy", async () => {
    const idempotencyKey = "00000000-0000-4000-8000-000000000002";
    const client = createBaseHttpClient({ fetch: absoluteFetch(viteOrigin) });
    await client.request(`/api/v1/leads/${leadId}/move`, {
      kind: "conditional-idempotent-mutation",
      method: "POST",
      body: { stage: "QUALIFIED" },
      ifMatch: `"lead:${leadId}:7"`,
      idempotencyKey,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["if-match"]).toBe(`"lead:${leadId}:7"`);
    expect(calls[0]?.headers["x-genesis-if-match"]).toBeUndefined();
    expect(calls[0]?.headers["idempotency-key"]).toBe(idempotencyKey);
  });

  it("preserves a genuine upstream 412 for the frontend", async () => {
    const client = createBaseHttpClient({ fetch: absoluteFetch(viteOrigin) });
    await expect(
      client.request(`/api/v1/leads/${leadId}`, {
        kind: "conditional-mutation",
        method: "PATCH",
        body: { name: "stale" },
        ifMatch: `"lead:${leadId}:6"`,
      }),
    ).rejects.toMatchObject({ kind: "precondition-failed", status: 412 });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["standard", { "If-Match": `"lead:${leadId}:7"` }],
    [
      "both",
      {
        "If-Match": `"lead:${leadId}:7"`,
        [GENESIS_IF_MATCH_HEADER]: `"lead:${leadId}:7"`,
      },
    ],
    ["invalid", { [GENESIS_IF_MATCH_HEADER]: "*" }],
  ])("rejects %s transport with zero upstream", async (_kind, headers) => {
    const response = await nodeFetch(`${viteOrigin}/api/v1/leads/${leadId}`, {
      method: "PATCH",
      headers,
      body: "{}",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls).toHaveLength(0);
  });

  it("preserves non-conditional requests", async () => {
    const response = await nodeFetch(`${viteOrigin}/api/v1/auth/bootstrap`);
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers["if-match"]).toBeUndefined();
    expect(calls[0]?.headers["x-genesis-if-match"]).toBeUndefined();
  });

  it("preserves the missing-target 503 fail-closed behavior", async () => {
    const configuredTarget = process.env.GENESIS_API_PROXY_TARGET;
    delete process.env.GENESIS_API_PROXY_TARGET;
    const isolated = await createViteServer({
      root: process.cwd(),
      configFile: path.resolve(process.cwd(), "vite.config.ts"),
      logLevel: "silent",
      server: { host, port: 0, strictPort: false },
    });
    try {
      await isolated.listen();
      const address = isolated.httpServer?.address();
      if (!address || typeof address === "string") {
        throw new Error("Isolated Vite address unavailable.");
      }
      const response = await nodeFetch(
        `http://${host}:${address.port}/api/v1/auth/bootstrap`,
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally {
      await isolated.close();
      if (configuredTarget !== undefined) {
        process.env.GENESIS_API_PROXY_TARGET = configuredTarget;
      }
    }
    expect(calls).toHaveLength(0);
  });
});
