import { isIP } from "node:net";

const PRODUCTION_FRONTEND_HOST = "app.agenciagenesismkt.com.br";
const PRODUCTION_API_ORIGIN = "https://api.agenciagenesismkt.com.br";
const API_PREFIX = "/api/v1";
const INTERNAL_FUNCTION_PATH = "/api/proxy";
const INTERNAL_PATH_PARAMETER = "__genesis_proxy_path";
const MAX_BODY_BYTES = 4_500_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

const FIXED_HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const RESPONSE_CACHE_HEADERS = new Set([
  "age",
  "cdn-cache-control",
  "surrogate-control",
  "vercel-cdn-cache-control",
  "x-vercel-cache",
]);

const CLIENT_IP_ALIAS_HEADERS = new Set([
  "cf-connecting-ip",
  "client-ip",
  "fastly-client-ip",
  "fly-client-ip",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-envoy-external-address",
  "x-original-forwarded-for",
  "x-proxyuser-ip",
]);

const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

class BodyLimitExceeded extends Error {}

function hasUnsafeAscii(value: string, includeSpace: boolean): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 127 || code < (includeSpace ? 33 : 32)) return true;
  }
  return false;
}

export interface ProxyEnvironment {
  VERCEL_ENV?: string;
  GENESIS_API_PROXY_TARGET?: string;
  GENESIS_ORIGIN_KEY?: string;
}

export interface ProxyDependencies {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

function failClosed(status: 400 | 404 | 413 | 502 | 503): Response {
  return Response.json(
    { statusCode: status, message: "API integration unavailable." },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}

function canonicalizeIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const canonical: string[] = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    canonical.push(String(octet));
  }
  return canonical.join(".");
}

function canonicalizeIpv6(value: string): string | null {
  const mappedIpv4 = value.match(/^::ffff:(.+)$/iu)?.[1];
  if (mappedIpv4) {
    const canonicalIpv4 = canonicalizeIpv4(mappedIpv4);
    return canonicalIpv4 ? `::ffff:${canonicalIpv4}` : null;
  }
  try {
    const hostname = new URL(`http://[${value}]/`).hostname;
    return hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1).toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function canonicalizeVercelClientIp(value: string): string | null {
  if (
    value.length === 0 ||
    value.length > 45 ||
    value !== value.trim() ||
    value.includes(",") ||
    value.includes("%") ||
    hasUnsafeAscii(value, true)
  ) {
    return null;
  }
  const version = isIP(value);
  if (version === 4) return canonicalizeIpv4(value);
  if (version === 6) return canonicalizeIpv6(value);
  return null;
}

function parseConnectionTokens(headers: Headers): Set<string> | null {
  const dynamic = new Set<string>();
  const connection = headers.get("connection");
  if (!connection) return dynamic;
  if (connection.length > 1_024 || hasUnsafeAscii(connection, false)) {
    return null;
  }
  for (const rawToken of connection.split(",")) {
    const token = rawToken.trim().toLowerCase();
    if (!TOKEN.test(token)) return null;
    dynamic.add(token);
  }
  return dynamic;
}

function parseContentLength(headers: Headers): number | null | undefined {
  const value = headers.get("content-length");
  if (value === null) return undefined;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
): Promise<ArrayBuffer | undefined> {
  if (!body) return undefined;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new BodyLimitExceeded();
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

function isApiPath(url: URL): boolean {
  if (
    url.pathname !== API_PREFIX &&
    !url.pathname.startsWith(`${API_PREFIX}/`)
  ) {
    return false;
  }
  if (url.pathname.includes("\\")) return false;
  try {
    const decoded = decodeURIComponent(url.pathname);
    return !decoded.split("/").some((segment) => segment === "..");
  } catch {
    return false;
  }
}

function hasProductionRequestAuthority(request: Request): boolean {
  return (
    request.headers.get("host") === PRODUCTION_FRONTEND_HOST &&
    request.headers.get("x-forwarded-host") === PRODUCTION_FRONTEND_HOST &&
    request.headers.get("x-forwarded-proto") === "https"
  );
}

export function resolvePublicApiUrl(requestUrl: URL): URL | null {
  const internalValues = requestUrl.searchParams.getAll(
    INTERNAL_PATH_PARAMETER,
  );
  if (isApiPath(requestUrl)) {
    return internalValues.length === 0 ? requestUrl : null;
  }
  if (
    requestUrl.pathname !== INTERNAL_FUNCTION_PATH ||
    internalValues.length !== 1
  ) {
    return null;
  }

  const capturedPath = internalValues[0];
  if (
    capturedPath.startsWith("/") ||
    capturedPath.includes("\\") ||
    capturedPath.includes("?") ||
    capturedPath.includes("#")
  ) {
    return null;
  }
  const publicUrl = new URL(requestUrl);
  publicUrl.pathname = capturedPath
    ? `${API_PREFIX}/${capturedPath}`
    : API_PREFIX;
  publicUrl.searchParams.delete(INTERNAL_PATH_PARAMETER);
  return isApiPath(publicUrl) ? publicUrl : null;
}

function resolveConfiguration(environment: ProxyEnvironment): {
  target: URL;
  originKey: string;
} | null {
  const candidate = environment.GENESIS_API_PROXY_TARGET?.trim();
  const originKey = environment.GENESIS_ORIGIN_KEY;
  if (!candidate || !originKey || !/^[A-Za-z0-9_-]{43,128}$/u.test(originKey)) {
    return null;
  }
  try {
    const target = new URL(candidate);
    if (
      target.origin !== PRODUCTION_API_ORIGIN ||
      target.href !== `${PRODUCTION_API_ORIGIN}/` ||
      target.username ||
      target.password
    ) {
      return null;
    }
    return { target, originKey };
  } catch {
    return null;
  }
}

function buildUpstreamHeaders(
  request: Request,
  originKey: string,
  clientIp: string,
  dynamic: Set<string>,
): Headers {
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    if (
      FIXED_HOP_BY_HOP.has(lower) ||
      dynamic.has(lower) ||
      lower === "host" ||
      lower === "content-length" ||
      lower === "accept-encoding" ||
      lower === "forwarded" ||
      lower === "via" ||
      lower === "x-real-ip" ||
      CLIENT_IP_ALIAS_HEADERS.has(lower) ||
      lower.startsWith("x-forwarded-") ||
      lower.startsWith("x-vercel-") ||
      lower.startsWith("x-genesis-")
    ) {
      continue;
    }
    headers.append(name, value);
  }
  headers.set("Accept-Encoding", "identity");
  headers.set("X-Genesis-Origin-Key", originKey);
  headers.set("X-Genesis-Client-IP", clientIp);
  return headers;
}

function readSetCookies(headers: Headers): string[] {
  return headers.getSetCookie();
}

function validHostOnlyCookie(cookie: string): boolean {
  return (
    !hasUnsafeAscii(cookie, false) &&
    !/(?:^|;)\s*domain\s*=/iu.test(cookie) &&
    /(?:^|;)\s*secure(?:;|$)/iu.test(cookie) &&
    /(?:^|;)\s*path\s*=\s*\/(?:;|$)/iu.test(cookie)
  );
}

export function rewriteSafeLocation(value: string): string | null {
  if (!value || hasUnsafeAscii(value, false) || value.startsWith("//")) {
    return null;
  }
  if (value.startsWith("/")) {
    try {
      const parsed = new URL(value, "https://app.agenciagenesismkt.com.br");
      return isApiPath(parsed)
        ? `${parsed.pathname}${parsed.search}${parsed.hash}`
        : null;
    } catch {
      return null;
    }
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.origin !== PRODUCTION_API_ORIGIN &&
      parsed.origin !== `https://${PRODUCTION_FRONTEND_HOST}`
    ) {
      return null;
    }
    return isApiPath(parsed)
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : null;
  } catch {
    return null;
  }
}

function buildResponseHeaders(upstream: Response): Headers | null {
  const dynamic = parseConnectionTokens(upstream.headers);
  if (dynamic === null) return null;
  if (dynamic.has("set-cookie")) return null;
  const contentEncoding = upstream.headers.get("content-encoding");
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    return null;
  }
  const cookies = readSetCookies(upstream.headers);
  if (cookies.some((cookie) => !validHostOnlyCookie(cookie))) {
    return null;
  }

  const headers = new Headers();
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase();
    if (
      FIXED_HOP_BY_HOP.has(lower) ||
      dynamic.has(lower) ||
      RESPONSE_CACHE_HEADERS.has(lower) ||
      lower === "cache-control" ||
      lower === "content-length" ||
      lower === "set-cookie" ||
      lower.startsWith("x-genesis-")
    ) {
      continue;
    }
    if (lower === "location") {
      const safe = rewriteSafeLocation(value);
      if (!safe) return null;
      headers.set("Location", safe);
      continue;
    }
    headers.append(name, value);
  }
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vercel-CDN-Cache-Control", "no-store");
  return headers;
}

export async function handleApiProxy(
  request: Request,
  environment: ProxyEnvironment,
  dependencies: ProxyDependencies = {},
): Promise<Response> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return failClosed(400);
  }
  const publicApiUrl = resolvePublicApiUrl(requestUrl);
  if (
    environment.VERCEL_ENV !== "production" ||
    !hasProductionRequestAuthority(request) ||
    !publicApiUrl
  ) {
    return failClosed(404);
  }

  const configuration = resolveConfiguration(environment);
  if (!configuration) return failClosed(503);
  const dynamic = parseConnectionTokens(request.headers);
  if (dynamic === null) return failClosed(400);
  const forwardedFor = request.headers.get("x-vercel-forwarded-for");
  const clientIp = forwardedFor
    ? canonicalizeVercelClientIp(forwardedFor)
    : null;
  if (!clientIp) return failClosed(400);

  const contentLength = parseContentLength(request.headers);
  if (contentLength === null) return failClosed(400);
  if (contentLength !== undefined && contentLength > MAX_BODY_BYTES) {
    return failClosed(413);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await readBodyWithLimit(request.body);
    } catch (error) {
      return failClosed(error instanceof BodyLimitExceeded ? 413 : 400);
    }
  }

  const target = new URL(
    `${publicApiUrl.pathname}${publicApiUrl.search}`,
    configuration.target,
  );
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? UPSTREAM_TIMEOUT_MS,
  );
  let upstream: Response;
  try {
    upstream = await (dependencies.fetch ?? globalThis.fetch)(target, {
      method: request.method,
      headers: buildUpstreamHeaders(
        request,
        configuration.originKey,
        clientIp,
        dynamic,
      ),
      body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return failClosed(502);
  } finally {
    globalThis.clearTimeout(timeout);
  }

  try {
    const upstreamLength = parseContentLength(upstream.headers);
    if (
      upstreamLength === null ||
      (upstreamLength !== undefined && upstreamLength > MAX_BODY_BYTES)
    ) {
      return failClosed(502);
    }
    const headers = buildResponseHeaders(upstream);
    if (!headers) return failClosed(502);
    const responseHasNoBody =
      request.method === "HEAD" ||
      upstream.status === 204 ||
      upstream.status === 304;
    const responseBody = responseHasNoBody
      ? null
      : ((await readBodyWithLimit(upstream.body)) ?? null);
    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return failClosed(502);
  }
}

export function productionProxyEnvironment(): ProxyEnvironment {
  return {
    VERCEL_ENV: process.env.VERCEL_ENV,
    GENESIS_API_PROXY_TARGET: process.env.GENESIS_API_PROXY_TARGET,
    GENESIS_ORIGIN_KEY: process.env.GENESIS_ORIGIN_KEY,
  };
}
