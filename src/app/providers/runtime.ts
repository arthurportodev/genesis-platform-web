import { createAuthApi } from "@/features/auth/api/auth-api";
import { createCsrfManager } from "@/features/auth/api/csrf";
import { createAuthCookieLock } from "@/features/auth/session/auth-cookie-lock";
import { createSessionChannel } from "@/features/auth/session/session-channel";
import {
  createSessionCoordinator,
  type SessionCoordinator,
} from "@/features/auth/session/session-coordinator";
import { createOrganizationPreferenceStore } from "@/features/organizations/organization-selection";
import {
  createAuthenticatedHttpClient,
  createBaseHttpClient,
} from "@/shared/api/http-client";
import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { environment } from "@/shared/config/environment";
import {
  createAppQueryClient,
  createSessionCache,
} from "@/app/providers/queryClient";

export interface AppRuntime {
  queryClient: ReturnType<typeof createAppQueryClient>;
  session: SessionCoordinator;
  http: AuthenticatedHttpClient;
  dispose(): void;
}

export function createAppRuntime(): AppRuntime {
  const queryClient = createAppQueryClient();
  const baseHttp = createBaseHttpClient();
  const channel = createSessionChannel(environment.sessionChannelName);
  const session = createSessionCoordinator({
    authApi: createAuthApi(baseHttp, createCsrfManager(baseHttp)),
    cookieLock: createAuthCookieLock(),
    channel,
    preference: createOrganizationPreferenceStore(),
    cache: createSessionCache(queryClient),
  });
  const http = createAuthenticatedHttpClient(baseHttp, {
    getAccessToken: () => session.getAccessToken(),
    getActiveOrganizationId: () => session.getActiveOrganizationId(),
    refresh: () => session.refreshForRequest(),
    expireSession: () => session.expireSession(),
    rebootstrap: () => session.rebootstrap(),
  });
  return {
    queryClient,
    session,
    http,
    dispose: () => session.dispose(),
  };
}
