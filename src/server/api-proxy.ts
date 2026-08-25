import { isIP } from "node:net";

import {
  GENESIS_IF_MATCH_HEADER_LOWER,
  parseConnectionHeaderTokens,
  resolveGenesisIfMatchTransport,
  type IfMatchTransportRejection,
} from "../shared/api/if-match-transport.js";

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
  log?: (event: SafeProxyTelemetry) => void;
  timeoutMs?: number;
}

export type ProxyRejectionReason =
  | IfMatchTransportRejection
  | "client_ip_unavailable"
  | "configuration_unavailable"
  | "environment_not_production"
  | "forwarded_host_mismatch"
  | "forwarded_proto_mismatch"
  | "host_authority_mismatch"
  | "public_api_url_unresolved"
  | "request_body_too_large"
  | "request_body_unreadable"
  | "request_content_length_invalid"
  | "request_url_invalid"
  | "upstream_body_unreadable"
  | "upstream_headers_invalid"
  | "upstream_length_invalid"
  | "upstream_unreachable";

export interface SafeProxyTelemetry {
  event: "genesis_api_proxy_rejection";
  reason: ProxyRejectionReason;
  methodClass:
    "DELETE" | "GET" | "HEAD" | "OPTIONS" | "OTHER" | "PATCH" | "POST" | "PUT";
  pathClass: "internal_function" | "other" | "public_api" | "unparseable";
  internalPathParameterCount: number;
  internalPathCaptureClass:
    "absent" | "empty" | "malformed" | "multiple" | "relative_path";
  internalPathCaptureEncoding:
    "absent" | "empty" | "literal_slash" | "other" | "percent_encoded_slash";
  captureMatchesPublicPath: boolean;
  publicQueryPresent: boolean;
  environmentClass:
    "development" | "other" | "preview" | "production" | "unavailable";
  hostMatchesProduction: boolean;
  forwardedHostMatchesProduction: boolean;
  hostForwardedEqual: boolean;
  protoClass: "http" | "https" | "other" | "unavailable";
  deploymentHeaderPresent: boolean;
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

function classifyMethod(method: string): SafeProxyTelemetry["methodClass"] {
  switch (method) {
    case "DELETE":
    case "GET":
    case "HEAD":
    case "OPTIONS":
    case "PATCH":
    case "POST":
    case "PUT":
      return method;
    default:
      return "OTHER";
  }
}

function classifyEnvironment(
  value: string | undefined,
): SafeProxyTelemetry["environmentClass"] {
  if (value === undefined || value.length === 0) return "unavailable";
  if (
    value === "production" ||
    value === "preview" ||
    value === "development"
  ) {
    return value;
  }
  return "other";
}

function classifyProto(value: string | null): SafeProxyTelemetry["protoClass"] {
  if (value === null || value.length === 0) return "unavailable";
  if (value === "https" || value === "http") return value;
  return "other";
}

function classifyPath(requestUrl: URL | null): SafeProxyTelemetry["pathClass"] {
  if (!requestUrl) return "unparseable";
  if (isApiPath(requestUrl)) return "public_api";
  if (requestUrl.pathname === INTERNAL_FUNCTION_PATH)
    return "internal_function";
  return "other";
}

function rejectProxyRequest(
  request: Request,
  environment: ProxyEnvironment,
  dependencies: ProxyDependencies,
  requestUrl: URL | null,
  reason: ProxyRejectionReason,
  status: 400 | 404 | 413 | 502 | 503,
): Response {
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const internalPathParameterCount =
    requestUrl?.searchParams.getAll(INTERNAL_PATH_PARAMETER).length ?? 0;
  const internalValues =
    requestUrl?.searchParams.getAll(INTERNAL_PATH_PARAMETER) ?? [];
  const capturedPath = internalValues.length === 1 ? internalValues[0] : null;
  const captureMalformed =
    capturedPath !== null &&
    (capturedPath.startsWith("/") ||
      capturedPath.includes("\\") ||
      capturedPath.includes("?") ||
      capturedPath.includes("#"));
  const internalPathCaptureClass: SafeProxyTelemetry["internalPathCaptureClass"] =
    internalValues.length === 0
      ? "absent"
      : internalValues.length > 1
        ? "multiple"
        : capturedPath === ""
          ? "empty"
          : captureMalformed
            ? "malformed"
            : "relative_path";
  const rawInternalCaptures = requestUrl
    ? Array.from(
        requestUrl.search
          .slice(1)
          .matchAll(/(?:^|&)__genesis_proxy_path=([^&]*)/giu),
      ).map((match) => match[1])
    : [];
  const rawCapture =
    rawInternalCaptures.length === 1 ? rawInternalCaptures[0] : null;
  const internalPathCaptureEncoding: SafeProxyTelemetry["internalPathCaptureEncoding"] =
    rawCapture === null
      ? "absent"
      : rawCapture === ""
        ? "empty"
        : /%2f/iu.test(rawCapture)
          ? "percent_encoded_slash"
          : rawCapture.includes("/")
            ? "literal_slash"
            : "other";
  const expectedPublicCapture =
    requestUrl && isApiPath(requestUrl)
      ? requestUrl.pathname === API_PREFIX
        ? ""
        : requestUrl.pathname.slice(`${API_PREFIX}/`.length)
      : null;
  const publicQueryPresent =
    requestUrl !== null &&
    Array.from(requestUrl.searchParams.keys()).some(
      (name) => name !== INTERNAL_PATH_PARAMETER,
    );
  const event: SafeProxyTelemetry = {
    event: "genesis_api_proxy_rejection",
    reason,
    methodClass: classifyMethod(request.method),
    pathClass: classifyPath(requestUrl),
    internalPathParameterCount,
    internalPathCaptureClass,
    internalPathCaptureEncoding,
    captureMatchesPublicPath:
      capturedPath !== null && capturedPath === expectedPublicCapture,
    publicQueryPresent,
    environmentClass: classifyEnvironment(environment.VERCEL_ENV),
    hostMatchesProduction: host === PRODUCTION_FRONTEND_HOST,
    forwardedHostMatchesProduction: forwardedHost === PRODUCTION_FRONTEND_HOST,
    hostForwardedEqual: host !== null && host === forwardedHost,
    protoClass: classifyProto(request.headers.get("x-forwarded-proto")),
    deploymentHeaderPresent: request.headers.has("x-vercel-deployment-url"),
  };
  (
    dependencies.log ?? ((safeEvent) => console.info(JSON.stringify(safeEvent)))
  )(event);
  return failClosed(status);
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

function productionAuthorityRejection(
  request: Request,
): ProxyRejectionReason | null {
  if (request.headers.get("host") !== PRODUCTION_FRONTEND_HOST) {
    return "host_authority_mismatch";
  }
  if (request.headers.get("x-forwarded-host") !== PRODUCTION_FRONTEND_HOST) {
    return "forwarded_host_mismatch";
  }
  if (request.headers.get("x-forwarded-proto") !== "https") {
    return "forwarded_proto_mismatch";
  }
  return null;
}

export function resolvePublicApiUrl(requestUrl: URL): URL | null {
  const internalValues = requestUrl.searchParams.getAll(
    INTERNAL_PATH_PARAMETER,
  );
  if (!isApiPath(requestUrl) || internalValues.length !== 1) {
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

  const expectedPublicCapture =
    requestUrl.pathname === API_PREFIX
      ? ""
      : requestUrl.pathname.slice(`${API_PREFIX}/`.length);
  if (capturedPath !== expectedPublicCapture) return null;

  const querySegments = requestUrl.search.slice(1).split("&");
  const rawInternalSegments = querySegments.filter(
    (segment) =>
      segment.slice(0, segment.indexOf("=")) === INTERNAL_PATH_PARAMETER,
  );
  if (rawInternalSegments.length !== 1) return null;
  const rawCapture = rawInternalSegments[0].slice(
    rawInternalSegments[0].indexOf("=") + 1,
  );
  try {
    if (decodeURIComponent(rawCapture.replace(/\+/gu, " ")) !== capturedPath) {
      return null;
    }
  } catch {
    return null;
  }

  const publicUrl = new URL(requestUrl);
  const publicQuerySegments = querySegments.filter(
    (segment) => segment !== rawInternalSegments[0],
  );
  publicUrl.search = publicQuerySegments.length
    ? `?${publicQuerySegments.join("&")}`
    : "";
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
  ifMatch: string | undefined,
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
  if (ifMatch) headers.set("If-Match", ifMatch);
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
  const dynamic = parseConnectionHeaderTokens(
    upstream.headers.has("connection")
      ? upstream.headers.get("connection")
      : null,
  );
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
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      null,
      "request_url_invalid",
      400,
    );
  }
  const publicApiUrl = resolvePublicApiUrl(requestUrl);
  if (environment.VERCEL_ENV !== "production") {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "environment_not_production",
      404,
    );
  }
  const authorityRejection = productionAuthorityRejection(request);
  if (authorityRejection) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      authorityRejection,
      404,
    );
  }
  if (!publicApiUrl) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "public_api_url_unresolved",
      404,
    );
  }

  const ifMatchTransport = resolveGenesisIfMatchTransport({
    method: request.method,
    pathname: publicApiUrl.pathname,
    directIfMatch: request.headers.has("if-match")
      ? request.headers.get("if-match")
      : null,
    genesisIfMatch: request.headers.has(GENESIS_IF_MATCH_HEADER_LOWER)
      ? request.headers.get(GENESIS_IF_MATCH_HEADER_LOWER)
      : null,
    connection: request.headers.has("connection")
      ? request.headers.get("connection")
      : null,
  });
  if (ifMatchTransport.rejection) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      ifMatchTransport.rejection,
      400,
    );
  }

  const configuration = resolveConfiguration(environment);
  if (!configuration) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "configuration_unavailable",
      503,
    );
  }
  const dynamic = new Set(ifMatchTransport.connectionTokens);
  const forwardedFor = request.headers.get("x-vercel-forwarded-for");
  const clientIp = forwardedFor
    ? canonicalizeVercelClientIp(forwardedFor)
    : null;
  if (!clientIp) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "client_ip_unavailable",
      400,
    );
  }

  const contentLength = parseContentLength(request.headers);
  if (contentLength === null) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "request_content_length_invalid",
      400,
    );
  }
  if (contentLength !== undefined && contentLength > MAX_BODY_BYTES) {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "request_body_too_large",
      413,
    );
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await readBodyWithLimit(request.body);
    } catch (error) {
      return rejectProxyRequest(
        request,
        environment,
        dependencies,
        requestUrl,
        error instanceof BodyLimitExceeded
          ? "request_body_too_large"
          : "request_body_unreadable",
        error instanceof BodyLimitExceeded ? 413 : 400,
      );
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
        ifMatchTransport.ifMatch,
      ),
      body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "upstream_unreachable",
      502,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  try {
    const upstreamLength = parseContentLength(upstream.headers);
    if (
      upstreamLength === null ||
      (upstreamLength !== undefined && upstreamLength > MAX_BODY_BYTES)
    ) {
      return rejectProxyRequest(
        request,
        environment,
        dependencies,
        requestUrl,
        "upstream_length_invalid",
        502,
      );
    }
    const headers = buildResponseHeaders(upstream);
    if (!headers) {
      return rejectProxyRequest(
        request,
        environment,
        dependencies,
        requestUrl,
        "upstream_headers_invalid",
        502,
      );
    }
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
    return rejectProxyRequest(
      request,
      environment,
      dependencies,
      requestUrl,
      "upstream_body_unreadable",
      502,
    );
  }
}

export function productionProxyEnvironment(): ProxyEnvironment {
  return {
    VERCEL_ENV: process.env.VERCEL_ENV,
    GENESIS_API_PROXY_TARGET: process.env.GENESIS_API_PROXY_TARGET,
    GENESIS_ORIGIN_KEY: process.env.GENESIS_ORIGIN_KEY,
  };
}
