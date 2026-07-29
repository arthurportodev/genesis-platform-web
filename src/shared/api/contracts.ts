export type HttpCallKind =
  | "public"
  | "authenticated"
  | "tenant-scoped"
  | "auth-cookie-mutation"
  | "conditional-mutation"
  | "idempotent-mutation"
  | "conditional-idempotent-mutation";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
  kind?: HttpCallKind;
  accessToken?: string;
  organizationId?: string;
  csrfToken?: string;
  ifMatch?: string;
  idempotencyKey?: string;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  etag?: string;
  idempotencyReplayed?: boolean;
}

export interface BaseHttpClient {
  request<T>(
    path: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;
}

export interface AuthenticatedRequestOptions extends Omit<
  HttpRequestOptions,
  "accessToken" | "organizationId"
> {
  kind:
    | "authenticated"
    | "tenant-scoped"
    | "conditional-mutation"
    | "idempotent-mutation"
    | "conditional-idempotent-mutation";
  replaySafety?: "rejected-before-effects";
}

export interface AuthenticatedHttpClient {
  request<T>(
    path: string,
    options: AuthenticatedRequestOptions,
  ): Promise<HttpResponse<T>>;
}
