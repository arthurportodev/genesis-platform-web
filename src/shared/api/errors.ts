import { z } from "zod";

export const errorKinds = [
  "network",
  "timeout",
  "aborted",
  "protocol",
  "validation",
  "unauthorized",
  "session-expired",
  "forbidden",
  "not-found",
  "conflict",
  "precondition-failed",
  "precondition-required",
  "rate-limited",
  "server",
  "unknown",
] as const;

export type AppErrorKind = (typeof errorKinds)[number];

const backendErrorSchema = z
  .object({
    statusCode: z.number().int(),
    message: z.union([z.string(), z.array(z.string())]),
    error: z.string().optional(),
    path: z.string().optional(),
    timestamp: z.string().optional(),
    code: z
      .enum([
        "EMAIL_VERIFICATION_REQUIRED",
        "AUTH_EMAIL_ALREADY_REGISTERED",
        "AUTH_EMAIL_VERIFICATION_INVALID",
        "AUTH_EMAIL_VERIFICATION_UNAVAILABLE",
        "AUTH_EMAIL_VERIFICATION_RATE_LIMITED",
        "AUTH_REGISTRATION_RATE_LIMITED",
        "AUTH_PASSWORD_HASH_CAPACITY_EXCEEDED",
        "AUTH_REGISTRATION_INVALID",
        "AUTH_REGISTRATION_UNAVAILABLE",
        "AUTH_OTP_PUBLIC_FLOWS_DISABLED",
        "AUTH_PASSWORD_RESET_INVALID",
        "AUTH_PASSWORD_RESET_PUBLIC_FLOW_DISABLED",
        "AUTH_PASSWORD_RESET_RATE_LIMITED",
        "AUTH_PASSWORD_RESET_UNAVAILABLE",
        "AUTH_GOOGLE_LINK_REQUIRED",
        "AUTH_GOOGLE_PROFILE_REQUIRED",
        "AUTH_GOOGLE_PROFILE_INVALID",
        "AUTH_GOOGLE_INVALID",
        "AUTH_GOOGLE_UNAVAILABLE",
        "AUTH_GOOGLE_RATE_LIMITED",
        "AUTH_GOOGLE_RETRY",
      ])
      .optional(),
    continuation: z
      .object({
        challengeId: z.uuidv4(),
        expiresAt: z.iso.datetime({ offset: true }),
        resendAvailableAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .optional(),
    googleContinuation: z
      .object({
        challengeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
        expiresAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  readonly details?: readonly string[];
  readonly code?: z.infer<typeof backendErrorSchema>["code"];
  readonly continuation?: z.infer<typeof backendErrorSchema>["continuation"];
  readonly googleContinuation?: z.infer<
    typeof backendErrorSchema
  >["googleContinuation"];

  constructor(
    kind: AppErrorKind,
    message: string,
    options: {
      cause?: unknown;
      status?: number;
      details?: readonly string[];
      code?: z.infer<typeof backendErrorSchema>["code"];
      continuation?: z.infer<typeof backendErrorSchema>["continuation"];
      googleContinuation?: z.infer<
        typeof backendErrorSchema
      >["googleContinuation"];
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.kind = kind;
    this.status = options.status;
    this.details = options.details;
    this.code = options.code;
    this.continuation = options.continuation;
    this.googleContinuation = options.googleContinuation;
  }
}

export function appErrorKindForStatus(status: number): AppErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 412) return "precondition-failed";
  if (status === 428) return "precondition-required";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server";
  return "unknown";
}

export function createHttpError(status: number, body: unknown): AppError {
  const parsed = backendErrorSchema.safeParse(body);
  const messages = parsed.success
    ? Array.isArray(parsed.data.message)
      ? parsed.data.message
      : [parsed.data.message]
    : undefined;
  return new AppError(
    appErrorKindForStatus(status),
    safeMessageForKind(appErrorKindForStatus(status)),
    {
      status,
      details: messages,
      code: parsed.success ? parsed.data.code : undefined,
      continuation: parsed.success ? parsed.data.continuation : undefined,
      googleContinuation: parsed.success
        ? parsed.data.googleContinuation
        : undefined,
    },
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AppError("aborted", "", { cause: error });
  }
  if (error instanceof TypeError) {
    return new AppError(
      "network",
      "Não foi possível conectar ao serviço. Tente novamente.",
      { cause: error },
    );
  }
  return new AppError(
    "unknown",
    "Não foi possível concluir a operação. Tente novamente.",
    { cause: error },
  );
}

export function safeMessageForKind(kind: AppErrorKind): string {
  switch (kind) {
    case "validation":
      return "Revise os dados informados.";
    case "unauthorized":
      return "Não foi possível confirmar suas credenciais.";
    case "session-expired":
      return "Sua sessão expirou. Entre novamente.";
    case "forbidden":
      return "Você não possui acesso a este recurso.";
    case "not-found":
      return "O recurso solicitado não foi encontrado.";
    case "conflict":
      return "Os dados foram alterados. Atualize e tente novamente.";
    case "precondition-failed":
      return "Há uma versão mais recente destes dados.";
    case "precondition-required":
      return "Atualize os dados antes de continuar.";
    case "rate-limited":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "network":
      return "Não foi possível conectar ao serviço. Tente novamente.";
    case "timeout":
      return "A operação demorou mais que o esperado. Tente novamente.";
    case "aborted":
      return "";
    case "protocol":
      return "A integração está temporariamente indisponível.";
    case "server":
    case "unknown":
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}

export function isRetryableQueryError(error: unknown): boolean {
  const kind = toAppError(error).kind;
  return kind === "network" || kind === "timeout" || kind === "server";
}
