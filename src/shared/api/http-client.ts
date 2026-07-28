import type {
  AuthenticatedHttpClient,
  AuthenticatedRequestOptions,
  BaseHttpClient,
  HttpRequestOptions,
  HttpResponse,
} from "@/shared/api/contracts";
import { AppError, createHttpError, toAppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";

const MAX_ERROR_BODY_BYTES = 16_384;
const MAX_SUCCESS_BODY_BYTES = 1_048_576;
const VALIDATION_ORIGIN = "https://genesis.invalid";

interface BaseHttpClientDependencies {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  rateLimitCooldownMs?: number;
  now?: () => number;
}

function assertApiPath(path: string): void {
  let parsed: URL;
  try {
    parsed = new URL(path, VALIDATION_ORIGIN);
  } catch {
    throw new AppError("protocol", "Caminho de API inválido.");
  }
  const canonical = `${parsed.pathname}${parsed.search}`;
  if (
    parsed.origin !== VALIDATION_ORIGIN ||
    parsed.hash !== "" ||
    canonical !== path ||
    !parsed.pathname.startsWith(`${environment.apiBasePath}/`) ||
    path.includes("\\")
  )
    throw new AppError("protocol", "Caminho de API inválido.");
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timeoutReached = false;
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) controller.abort(callerSignal.reason);
  else callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

  const timeout = globalThis.setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException("Timeout", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => {
      globalThis.clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    },
    timedOut: () => timeoutReached,
  };
}

async function readLimitedBody(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new AppError("protocol", "A integração retornou dados em excesso.", {
      status: response.status,
    });
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new AppError(
          "protocol",
          "A integração retornou dados em excesso.",
          { status: response.status },
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await readLimitedBody(
    response,
    response.ok ? MAX_SUCCESS_BODY_BYTES : MAX_ERROR_BODY_BYTES,
  );
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("+json")
  ) {
    throw new AppError(
      "protocol",
      text.trimStart().startsWith("<")
        ? "A integração retornou uma página inesperada."
        : "A integração retornou um formato inesperado.",
      { status: response.status },
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AppError("protocol", "A integração retornou JSON inválido.", {
      cause: error,
      status: response.status,
    });
  }
}

function assertRequestOptions(options: HttpRequestOptions): void {
  const kind = options.kind ?? "public";
  const tenantScoped =
    kind === "tenant-scoped" ||
    kind === "conditional-mutation" ||
    kind === "idempotent-mutation";
  const bearerAllowed =
    tenantScoped || kind === "authenticated" || kind === "auth-cookie-mutation";
  if (options.accessToken && !bearerAllowed)
    throw new AppError("protocol", "Bearer incompatível com a chamada.");
  if (options.organizationId && !tenantScoped)
    throw new AppError("protocol", "Organization incompatível com a chamada.");
  if (options.csrfToken && kind !== "auth-cookie-mutation")
    throw new AppError("protocol", "CSRF incompatível com a chamada.");
  if (options.ifMatch && kind !== "conditional-mutation")
    throw new AppError("protocol", "If-Match incompatível com a chamada.");
  if (options.idempotencyKey && kind !== "idempotent-mutation")
    throw new AppError(
      "protocol",
      "Idempotency-Key incompatível com a chamada.",
    );
  if (kind === "conditional-mutation" && !options.ifMatch)
    throw new AppError("protocol", "If-Match é obrigatório nesta chamada.");
  if (kind === "idempotent-mutation" && !options.idempotencyKey)
    throw new AppError(
      "protocol",
      "Idempotency-Key é obrigatória nesta chamada.",
    );
}

export function createBaseHttpClient(
  dependencies: BaseHttpClientDependencies = {},
): BaseHttpClient {
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch;
  const timeoutMs = dependencies.timeoutMs ?? environment.httpTimeoutMs;
  const rateLimitCooldownMs =
    dependencies.rateLimitCooldownMs ?? environment.rateLimitCooldownMs;
  const now = dependencies.now ?? Date.now;
  let rateLimitedUntil = 0;

  return {
    async request<T>(
      path: string,
      options: HttpRequestOptions = {},
    ): Promise<HttpResponse<T>> {
      assertApiPath(path);
      assertRequestOptions(options);
      if (now() < rateLimitedUntil)
        throw new AppError(
          "rate-limited",
          "Muitas tentativas. Aguarde um pouco e tente novamente.",
          { status: 429 },
        );
      const method = options.method ?? "GET";
      const headers = new Headers();
      headers.set("Accept", "application/json");
      if (options.body !== undefined)
        headers.set("Content-Type", "application/json");
      if (options.accessToken)
        headers.set("Authorization", `Bearer ${options.accessToken}`);
      if (options.organizationId)
        headers.set("X-Organization-Id", options.organizationId);
      if (options.csrfToken) headers.set("X-CSRF-Token", options.csrfToken);
      if (options.ifMatch) headers.set("If-Match", options.ifMatch);
      if (options.idempotencyKey)
        headers.set("Idempotency-Key", options.idempotencyKey);

      const combined = combineAbortSignals(options.signal, timeoutMs);
      try {
        if (combined.signal.aborted) {
          throw new DOMException("Abort", "AbortError");
        }
        const response = await fetchImplementation(path, {
          method,
          headers,
          credentials: "include",
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: combined.signal,
        });
        if (response.status === 429)
          rateLimitedUntil = now() + rateLimitCooldownMs;
        const body = await parseResponseBody(response);
        if (!response.ok) throw createHttpError(response.status, body);
        return {
          data: body as T,
          status: response.status,
          ...(response.headers.get("etag")
            ? { etag: response.headers.get("etag") ?? undefined }
            : {}),
          ...(response.headers.get("idempotency-replayed")
            ? {
                idempotencyReplayed:
                  response.headers.get("idempotency-replayed") === "true",
              }
            : {}),
        };
      } catch (error) {
        if (combined.timedOut()) {
          throw new AppError(
            "timeout",
            "A operação demorou mais que o esperado. Tente novamente.",
            { cause: error },
          );
        }
        throw toAppError(error);
      } finally {
        combined.dispose();
      }
    },
  };
}

interface AuthenticatedClientDependencies {
  getAccessToken: () => string | null;
  getActiveOrganizationId: () => string | null;
  refresh: () => Promise<boolean>;
  expireSession: () => Promise<void> | void;
  rebootstrap: () => Promise<void>;
}

function canReplay(options: AuthenticatedRequestOptions): boolean {
  const method = options.method ?? "GET";
  return (
    method === "GET" ||
    options.replaySafety === "rejected-before-effects" ||
    options.idempotencyKey !== undefined
  );
}

export function createAuthenticatedHttpClient(
  base: BaseHttpClient,
  dependencies: AuthenticatedClientDependencies,
): AuthenticatedHttpClient {
  return {
    async request<T>(path: string, options: AuthenticatedRequestOptions) {
      const initialToken = dependencies.getAccessToken();
      if (!initialToken) {
        throw new AppError(
          "session-expired",
          "Sua sessão expirou. Entre novamente.",
        );
      }

      const organizationId =
        options.kind === "tenant-scoped" ||
        options.kind === "conditional-mutation" ||
        options.kind === "idempotent-mutation"
          ? dependencies.getActiveOrganizationId()
          : undefined;
      if (
        (options.kind === "tenant-scoped" ||
          options.kind === "conditional-mutation" ||
          options.kind === "idempotent-mutation") &&
        !organizationId
      ) {
        throw new AppError("forbidden", "Selecione uma organização.");
      }

      const dispatch = (token: string) =>
        base.request<T>(path, {
          ...options,
          accessToken: token,
          organizationId: organizationId ?? undefined,
        });

      try {
        return await dispatch(initialToken);
      } catch (error) {
        const normalized = toAppError(error);
        if (normalized.kind === "forbidden" && organizationId) {
          await dependencies.rebootstrap();
        }
        if (normalized.kind !== "unauthorized" || !canReplay(options))
          throw normalized;

        const currentToken = dependencies.getAccessToken();
        if (currentToken && currentToken !== initialToken) {
          try {
            return await dispatch(currentToken);
          } catch (retryError) {
            if (toAppError(retryError).kind === "unauthorized")
              await dependencies.expireSession();
            throw retryError;
          }
        }

        const refreshed = await dependencies.refresh();
        const refreshedToken = dependencies.getAccessToken();
        if (!refreshed || !refreshedToken) {
          throw new AppError(
            "session-expired",
            "Sua sessão expirou. Entre novamente.",
          );
        }
        try {
          return await dispatch(refreshedToken);
        } catch (retryError) {
          if (toAppError(retryError).kind === "unauthorized")
            await dependencies.expireSession();
          throw retryError;
        }
      }
    },
  };
}
