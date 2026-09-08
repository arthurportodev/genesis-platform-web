import {
  bootstrapResponseSchema,
  emailVerifiedResponseSchema,
  tokenResponseSchema,
  verificationRequiredResponseSchema,
  type BootstrapResponse,
  type TokenResponse,
  type EmailVerifiedResponse,
  type VerificationRequiredResponse,
} from "@/features/auth/api/auth-contracts";
import { runCsrfMutation, type CsrfManager } from "@/features/auth/api/csrf";
import type { BaseHttpClient } from "@/shared/api/contracts";
import { AppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";

export interface AuthApi {
  register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<VerificationRequiredResponse>;
  resendEmailVerification(input: {
    challengeId: string;
  }): Promise<VerificationRequiredResponse>;
  verifyEmail(input: {
    challengeId: string;
    code: string;
  }): Promise<EmailVerifiedResponse>;
  login(credentials: {
    email: string;
    password: string;
  }): Promise<TokenResponse>;
  refresh(): Promise<TokenResponse>;
  logout(): Promise<void>;
  logoutAll(accessToken: string): Promise<void>;
  bootstrap(accessToken: string): Promise<BootstrapResponse>;
}

function parseTokenResponse(value: unknown): TokenResponse {
  const parsed = tokenResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("protocol", "Resposta de autenticação inválida.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

function parseBootstrapResponse(value: unknown): BootstrapResponse {
  const parsed = bootstrapResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("protocol", "Resposta de bootstrap inválida.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

function parseVerificationRequiredResponse(
  value: unknown,
): VerificationRequiredResponse {
  const parsed = verificationRequiredResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("protocol", "Resposta de verificação inválida.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

function parseEmailVerifiedResponse(value: unknown): EmailVerifiedResponse {
  const parsed = emailVerifiedResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("protocol", "Resposta de verificação inválida.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function createAuthApi(
  http: BaseHttpClient,
  csrf: CsrfManager,
): AuthApi {
  const authPath = (resource: string) =>
    `${environment.apiBasePath}/auth/${resource}`;
  const csrfMutation = <T>(
    resource: string,
    options: {
      body?: unknown;
      accessToken?: string;
    } = {},
  ) =>
    runCsrfMutation(csrf, async (csrfToken) => {
      const response = await http.request<T>(authPath(resource), {
        method: "POST",
        kind: "auth-cookie-mutation",
        body: options.body,
        accessToken: options.accessToken,
        csrfToken,
      });
      return response.data;
    });

  return {
    async register(input) {
      return parseVerificationRequiredResponse(
        await csrfMutation<unknown>("register", { body: input }),
      );
    },
    async resendEmailVerification(input) {
      return parseVerificationRequiredResponse(
        await csrfMutation<unknown>("email-verification/resend", {
          body: input,
        }),
      );
    },
    async verifyEmail(input) {
      return parseEmailVerifiedResponse(
        await csrfMutation<unknown>("email-verification/verify", {
          body: input,
        }),
      );
    },
    async login(credentials) {
      return parseTokenResponse(
        await csrfMutation<unknown>("login", { body: credentials }),
      );
    },
    async refresh() {
      return parseTokenResponse(await csrfMutation<unknown>("refresh"));
    },
    async logout() {
      await csrfMutation<void>("logout");
    },
    async logoutAll(accessToken) {
      await csrfMutation<void>("logout-all", { accessToken });
    },
    async bootstrap(accessToken) {
      const response = await http.request<unknown>(authPath("bootstrap"), {
        kind: "authenticated",
        accessToken,
      });
      return parseBootstrapResponse(response.data);
    },
  };
}
