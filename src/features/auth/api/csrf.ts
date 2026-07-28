import type { BaseHttpClient } from "@/shared/api/contracts";
import { AppError, toAppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";
import { expireCookie, readRecognizedCsrfCookie } from "@/shared/lib/cookies";
import { csrfResponseSchema } from "@/features/auth/api/auth-contracts";

export interface CsrfManager {
  getToken(): Promise<string>;
  invalidate(): void;
}

export function createCsrfManager(
  http: BaseHttpClient,
  readCookies: () => string = () => document.cookie,
): CsrfManager {
  return {
    async getToken() {
      const current = readRecognizedCsrfCookie(
        readCookies(),
        environment.csrfCookieNames,
      );
      if (current.status === "found") return current.value;
      if (current.status === "invalid") {
        throw new AppError("protocol", "Cookie CSRF ambíguo ou inválido.");
      }

      const response = await http.request<unknown>(
        `${environment.apiBasePath}/auth/csrf`,
        { kind: "public" },
      );
      const parsed = csrfResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new AppError("protocol", "Resposta CSRF inválida.", {
          cause: parsed.error,
        });
      }
      const issued = readRecognizedCsrfCookie(
        readCookies(),
        environment.csrfCookieNames,
      );
      if (issued.status !== "found" || issued.value !== parsed.data.csrfToken) {
        throw new AppError(
          "protocol",
          "O cookie CSRF não corresponde à resposta da API.",
        );
      }
      return issued.value;
    },
    invalidate() {
      for (const name of environment.csrfCookieNames) expireCookie(name);
    },
  };
}

export async function runCsrfMutation<T>(
  csrf: CsrfManager,
  mutation: (token: string) => Promise<T>,
): Promise<T> {
  let token = await csrf.getToken();
  try {
    return await mutation(token);
  } catch (error) {
    const normalized = toAppError(error);
    if (normalized.kind !== "forbidden") throw normalized;
    csrf.invalidate();
    token = await csrf.getToken();
    try {
      return await mutation(token);
    } catch (retryError) {
      const retryNormalized = toAppError(retryError);
      if (retryNormalized.kind === "forbidden") {
        throw new AppError(
          "protocol",
          "Não foi possível validar a proteção da sessão.",
          { cause: retryError, status: 403 },
        );
      }
      throw retryNormalized;
    }
  }
}
