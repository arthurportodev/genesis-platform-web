import type { AuthApi } from "@/features/auth/api/auth-api";
import type {
  BootstrapResponse,
  TokenResponse,
} from "@/features/auth/api/auth-contracts";
import type { AuthCookieLock } from "@/features/auth/session/auth-cookie-lock";
import {
  initialSessionState,
  isAuthenticatedState,
  reduceSession,
  type SessionEvent,
  type SessionState,
} from "@/features/auth/session/session-machine";
import type {
  SessionChannel,
  SessionMessage,
  TokenUpdatedMessage,
} from "@/features/auth/session/session-channel";
import {
  resolveOrganization,
  type OrganizationPreferenceStore,
} from "@/features/organizations/organization-selection";
import { AppError, toAppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";

interface AccessCredential {
  value: string;
  expiresAt: number;
  generation: number;
}

type OutgoingMessage<T> = T extends SessionMessage
  ? Omit<T, "version" | "tabId">
  : never;

export interface SessionCache {
  cancelAndClearAuthenticated(): Promise<void>;
  hasPendingMutations(): boolean;
  cancelOrganization(organizationId: string): Promise<void>;
  removeOrganization(organizationId: string): void;
}

export interface SessionCoordinator {
  getSnapshot(): SessionState;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<void>;
  retry(): Promise<void>;
  login(credentials: { email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<{ globallyRevoked: boolean }>;
  selectOrganization(organizationId: string): Promise<void>;
  getAccessToken(): string | null;
  getActiveOrganizationId(): string | null;
  refreshForRequest(): Promise<boolean>;
  rebootstrap(): Promise<void>;
  expireSession(returnTo?: string): Promise<void>;
  setLifecycleListener(listener: () => void): () => void;
  dispose(): void;
}

interface SessionCoordinatorDependencies {
  authApi: AuthApi;
  cookieLock: AuthCookieLock;
  channel: SessionChannel;
  preference: OrganizationPreferenceStore;
  cache: SessionCache;
  now?: () => number;
  tabId?: string;
  peerWaitMs?: number;
}

function isShareable(
  credential: AccessCredential | null,
  now: number,
): credential is AccessCredential {
  return (
    credential !== null &&
    credential.expiresAt - now > environment.tokenValidityMarginMs
  );
}

export function expiresAtFromResponse(
  response: Pick<TokenResponse, "expiresIn">,
  receivedAt: number,
): number {
  return receivedAt + response.expiresIn * 1_000;
}

export function createSessionCoordinator(
  dependencies: SessionCoordinatorDependencies,
): SessionCoordinator {
  const now = dependencies.now ?? Date.now;
  const tabId = dependencies.tabId ?? crypto.randomUUID();
  const peerWaitMs = dependencies.peerWaitMs ?? 120;
  const listeners = new Set<() => void>();
  const lifecycleListeners = new Set<() => void>();
  let state = initialSessionState;
  let credential: AccessCredential | null = null;
  let observedGeneration = 0;
  let initialized = false;
  let initializePromise: Promise<void> | null = null;
  let refreshPromise: Promise<boolean> | null = null;
  let retryAction: (() => Promise<void>) | null = null;
  let disposed = false;

  const emit = (notifyLifecycle = false) => {
    for (const listener of listeners) listener();
    if (notifyLifecycle) {
      for (const listener of lifecycleListeners) listener();
    }
  };
  const dispatch = (event: SessionEvent, notifyLifecycle = false) => {
    state = reduceSession(state, event);
    emit(notifyLifecycle);
  };

  const post = (message: OutgoingMessage<SessionMessage>) => {
    dependencies.channel.post({
      version: 1,
      tabId,
      ...message,
    });
  };

  const adoptCredential = (
    message: Pick<
      TokenUpdatedMessage,
      "accessToken" | "expiresAt" | "generation"
    >,
  ): boolean => {
    observedGeneration = Math.max(observedGeneration, message.generation);
    if (
      message.expiresAt - now() <= environment.tokenValidityMarginMs ||
      (credential !== null && message.generation <= credential.generation)
    ) {
      return false;
    }
    credential = {
      value: message.accessToken,
      expiresAt: message.expiresAt,
      generation: message.generation,
    };
    return true;
  };

  const publishCredential = (requestId?: string) => {
    if (!isShareable(credential, now())) return;
    post({
      type: "token-updated",
      generation: credential.generation,
      accessToken: credential.value,
      expiresAt: credential.expiresAt,
      ...(requestId ? { requestId } : {}),
    });
  };

  const requestPeerCredential = async (): Promise<boolean> => {
    if (!dependencies.channel.available) return false;
    const requestId = crypto.randomUUID();
    let adopted = false;
    const unsubscribe = dependencies.channel.subscribe((message) => {
      if (
        message.type === "token-updated" &&
        message.requestId === requestId &&
        message.tabId !== tabId
      ) {
        adopted = adoptCredential(message) || adopted;
      }
    });
    post({
      type: "token-request",
      generation: observedGeneration,
      requestId,
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, peerWaitMs));
    unsubscribe();
    return adopted;
  };

  const clearAuthenticatedMaterial = async () => {
    credential = null;
    dependencies.preference.clear();
    await dependencies.cache.cancelAndClearAuthenticated();
  };

  const applyBootstrap = (
    bootstrap: BootstrapResponse,
    notifyLifecycle = false,
  ) => {
    const persisted = dependencies.preference.read();
    const resolution = resolveOrganization(bootstrap.organizations, persisted);
    if (resolution.kind === "selected") {
      dependencies.preference.write(resolution.organization.id);
      dispatch(
        {
          type: "AUTHENTICATED",
          data: {
            user: bootstrap.user,
            organizations: bootstrap.organizations,
            activeOrganization: resolution.organization,
          },
        },
        notifyLifecycle,
      );
      return;
    }
    dependencies.preference.clear();
    dispatch(
      {
        type: "AUTHENTICATED",
        data: {
          user: bootstrap.user,
          organizations: bootstrap.organizations,
          activeOrganization: null,
        },
        reason: resolution.kind,
      },
      notifyLifecycle,
    );
  };

  const bootstrap = async (
    allowRefresh: boolean,
    notifyLifecycle = false,
  ): Promise<void> => {
    const token = credential?.value;
    if (!token) throw new AppError("session-expired", "Sua sessão expirou.");
    try {
      applyBootstrap(
        await dependencies.authApi.bootstrap(token),
        notifyLifecycle,
      );
    } catch (error) {
      const normalized = toAppError(error);
      if (normalized.kind === "unauthorized" && allowRefresh) {
        const refreshed = await coordinatedRefresh(true);
        if (refreshed && credential) {
          applyBootstrap(
            await dependencies.authApi.bootstrap(credential.value),
            notifyLifecycle,
          );
          return;
        }
      }
      throw normalized;
    }
  };

  const acceptTokenResponse = (response: TokenResponse) => {
    observedGeneration += 1;
    credential = {
      value: response.accessToken,
      expiresAt: expiresAtFromResponse(response, now()),
      generation: observedGeneration,
    };
    publishCredential();
    post({ type: "csrf-updated", generation: observedGeneration });
  };

  const performRefreshInsideLock = async (force: boolean): Promise<boolean> => {
    const beforeGeneration = credential?.generation ?? observedGeneration;
    await requestPeerCredential();
    if (
      isShareable(credential, now()) &&
      (!force || credential.generation > beforeGeneration)
    ) {
      return true;
    }
    const previousAuthenticatedState = isAuthenticatedState(state)
      ? state
      : null;
    dispatch({ type: "REFRESH" });
    try {
      acceptTokenResponse(await dependencies.authApi.refresh());
      if (previousAuthenticatedState) {
        dispatch({
          type: "AUTHENTICATED",
          data: {
            user: previousAuthenticatedState.user,
            organizations: previousAuthenticatedState.organizations,
            activeOrganization: previousAuthenticatedState.activeOrganization,
          },
          reason:
            previousAuthenticatedState.status ===
            "authenticated-without-organization"
              ? previousAuthenticatedState.reason
              : undefined,
        });
      }
      return true;
    } catch (error) {
      const normalized = toAppError(error);
      if (normalized.kind === "unauthorized") {
        await clearAuthenticatedMaterial();
        dispatch(
          {
            type: "EXPIRED",
            message: "Sua sessão expirou. Entre novamente.",
          },
          true,
        );
        post({ type: "session-expired", generation: observedGeneration });
        return false;
      }
      retryAction = retryRefreshAndBootstrap;
      dispatch({
        type: "FATAL",
        message: normalized.message,
        retryable:
          normalized.kind === "network" || normalized.kind === "timeout",
      });
      throw normalized;
    }
  };

  const coordinatedRefresh = async (force = false): Promise<boolean> => {
    if (!force && isShareable(credential, now())) return true;
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const beforeGeneration = credential?.generation ?? observedGeneration;
      await requestPeerCredential();
      if (
        isShareable(credential, now()) &&
        (!force || credential.generation > beforeGeneration)
      ) {
        return true;
      }
      if (!dependencies.cookieLock.available) return false;
      return dependencies.cookieLock.run(() => performRefreshInsideLock(force));
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  };

  async function retryRefreshAndBootstrap(): Promise<void> {
    try {
      const refreshed = await coordinatedRefresh(true);
      if (!refreshed) {
        retryAction = null;
        return;
      }
      await bootstrap(false, true);
      retryAction = null;
    } catch (error) {
      const normalized = toAppError(error);
      if (
        normalized.kind === "unauthorized" ||
        normalized.kind === "session-expired"
      ) {
        await clearAuthenticatedMaterial();
        retryAction = null;
        dispatch(
          {
            type: "EXPIRED",
            message: "Sua sessão expirou. Entre novamente.",
          },
          true,
        );
        post({ type: "session-expired", generation: observedGeneration });
        return;
      }
      retryAction = retryRefreshAndBootstrap;
      dispatch({
        type: "FATAL",
        message: normalized.message,
        retryable:
          normalized.kind === "network" || normalized.kind === "timeout",
      });
      throw normalized;
    }
  }

  const initialize = async (): Promise<void> => {
    if (initialized) return;
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      dispatch({ type: "INITIALIZE" });
      retryAction = initialize;
      try {
        await requestPeerCredential();
        if (!isShareable(credential, now())) {
          const refreshed = await coordinatedRefresh(false);
          if (!refreshed) {
            if (state.status === "session-expired") return;
            dispatch({
              type: "ANONYMOUS",
              message: dependencies.cookieLock.available
                ? undefined
                : "Entre novamente neste navegador para continuar.",
            });
            return;
          }
        }
        await bootstrap(true);
        retryAction = null;
      } catch (error) {
        const normalized = toAppError(error);
        if (
          normalized.kind === "unauthorized" ||
          normalized.kind === "session-expired"
        ) {
          await clearAuthenticatedMaterial();
          dispatch({
            type: "EXPIRED",
            message: "Sua sessão expirou. Entre novamente.",
          });
          return;
        }
        dispatch({
          type: "FATAL",
          message: normalized.message,
          retryable:
            normalized.kind === "network" || normalized.kind === "timeout",
        });
      }
    })()
      .then(() => {
        initialized = true;
      })
      .finally(() => {
        initializePromise = null;
      });
    return initializePromise;
  };

  const unsubscribeChannel = dependencies.channel.subscribe((message) => {
    if (message.tabId === tabId) return;
    if (message.type === "token-request") {
      observedGeneration = Math.max(observedGeneration, message.generation);
      publishCredential(message.requestId);
      return;
    }
    if (message.type === "token-updated") {
      void (async () => {
        if (adoptCredential(message) && !isAuthenticatedState(state)) {
          try {
            await bootstrap(false, true);
          } catch {
            // A reconciliação explícita ou o guard tratará uma falha posterior.
          }
        }
      })();
      return;
    }
    const latestGeneration = Math.max(
      observedGeneration,
      credential?.generation ?? 0,
    );
    if (message.generation < latestGeneration) return;
    observedGeneration = Math.max(observedGeneration, message.generation);
    if (message.type === "logout" || message.type === "session-expired") {
      void (async () => {
        await clearAuthenticatedMaterial();
        dispatch(
          message.type === "logout"
            ? { type: "ANONYMOUS" }
            : {
                type: "EXPIRED",
                message: "Sua sessão expirou em outra aba.",
              },
          true,
        );
      })();
    }
  });

  const explicitCookieOperation = <T>(operation: () => Promise<T>) =>
    dependencies.cookieLock.available
      ? dependencies.cookieLock.run(operation)
      : operation();

  const finishCurrentLogout = async () => {
    await explicitCookieOperation(() => dependencies.authApi.logout());
    await clearAuthenticatedMaterial();
    post({ type: "logout", generation: observedGeneration });
    dispatch({ type: "ANONYMOUS" }, true);
    retryAction = null;
  };

  const finishGlobalLogout = async (): Promise<{
    globallyRevoked: boolean;
  }> => {
    if (!credential) return { globallyRevoked: false };
    const token = credential.value;
    if (isAuthenticatedState(state)) dispatch({ type: "LOGOUT" });
    try {
      await explicitCookieOperation(() =>
        dependencies.authApi.logoutAll(token),
      );
      await clearAuthenticatedMaterial();
      post({ type: "logout", generation: observedGeneration });
      retryAction = null;
      dispatch({ type: "ANONYMOUS" }, true);
      return { globallyRevoked: true };
    } catch (error) {
      const normalized = toAppError(error);
      if (normalized.kind === "unauthorized") {
        try {
          await explicitCookieOperation(() => dependencies.authApi.logout());
        } catch {
          // Limpeza remota best-effort após Bearer rejeitado.
        }
        await clearAuthenticatedMaterial();
        post({ type: "logout", generation: observedGeneration });
        retryAction = null;
        dispatch(
          {
            type: "ANONYMOUS",
            message:
              "A sessão local foi encerrada, mas a revogação global não pôde ser confirmada.",
          },
          true,
        );
        return { globallyRevoked: false };
      }
      retryAction = async () => {
        await finishGlobalLogout();
      };
      dispatch({
        type: "FATAL",
        message: normalized.message,
        retryable:
          normalized.kind === "network" ||
          normalized.kind === "timeout" ||
          normalized.kind === "server" ||
          normalized.kind === "rate-limited",
      });
      throw normalized;
    }
  };

  const reconcileAfterResume = async () => {
    if (disposed) return;
    const previousGeneration = credential?.generation ?? -1;
    try {
      await requestPeerCredential();
      if (
        credential?.generation !== undefined &&
        credential.generation > previousGeneration
      ) {
        await bootstrap(false, true);
        return;
      }
      if (!isShareable(credential, now())) {
        const refreshed = await coordinatedRefresh(false);
        if (refreshed) await bootstrap(false, true);
        else {
          await clearAuthenticatedMaterial();
          dispatch(
            {
              type: "ANONYMOUS",
              message:
                "Entre novamente neste navegador para continuar com segurança.",
            },
            true,
          );
        }
      }
    } catch (error) {
      const normalized = toAppError(error);
      dispatch({
        type: "FATAL",
        message: normalized.message,
        retryable:
          normalized.kind === "network" || normalized.kind === "timeout",
      });
      retryAction = reconcileAfterResume;
    }
  };

  const onResume = () => {
    void reconcileAfterResume();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") onResume();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize,
    async retry() {
      initialized = false;
      if (retryAction) await retryAction();
      else await initialize();
    },
    async login(credentials) {
      dispatch({ type: "LOGIN" });
      try {
        const response = await explicitCookieOperation(() =>
          dependencies.authApi.login(credentials),
        );
        acceptTokenResponse(response);
        await bootstrap(false);
        retryAction = null;
      } catch (error) {
        const normalized = toAppError(error);
        credential = null;
        dispatch({
          type: "ANONYMOUS",
          message:
            normalized.kind === "unauthorized"
              ? "E-mail ou senha inválidos."
              : normalized.message,
        });
        throw normalized;
      }
    },
    async logout() {
      if (!isAuthenticatedState(state)) return;
      dispatch({ type: "LOGOUT" });
      retryAction = finishCurrentLogout;
      try {
        await finishCurrentLogout();
      } catch (error) {
        const normalized = toAppError(error);
        dispatch({
          type: "FATAL",
          message: normalized.message,
          retryable: true,
        });
        throw normalized;
      }
    },
    logoutAll: finishGlobalLogout,
    async selectOrganization(organizationId) {
      if (!isAuthenticatedState(state)) {
        throw new AppError("session-expired", "Sua sessão expirou.");
      }
      const target = state.organizations.find(
        ({ id }) => id === organizationId,
      );
      if (!target) {
        dependencies.preference.clear();
        throw new AppError("forbidden", "Organização indisponível.");
      }
      const previous = state.activeOrganization;
      if (previous && dependencies.cache.hasPendingMutations()) {
        throw new AppError(
          "conflict",
          "Aguarde a operação atual terminar antes de trocar de organização.",
        );
      }
      dispatch({ type: "SWITCH", targetOrganizationId: organizationId });
      try {
        if (previous) {
          await dependencies.cache.cancelOrganization(previous.id);
          dependencies.cache.removeOrganization(previous.id);
        }
        dependencies.preference.write(target.id);
        dispatch(
          {
            type: "AUTHENTICATED",
            data: {
              user: state.user,
              organizations: state.organizations,
              activeOrganization: target,
            },
          },
          true,
        );
        post({
          type: "organization-preference-updated",
          generation: observedGeneration,
          organizationId: target.id,
        });
      } catch (error) {
        dispatch({
          type: "AUTHENTICATED",
          data: {
            user: state.user,
            organizations: state.organizations,
            activeOrganization: previous,
          },
        });
        throw error;
      }
    },
    getAccessToken() {
      if (state.status === "logging-out") return null;
      return isShareable(credential, now()) ? credential.value : null;
    },
    getActiveOrganizationId() {
      return isAuthenticatedState(state) &&
        state.status !== "switching-organization" &&
        state.status !== "logging-out"
        ? (state.activeOrganization?.id ?? null)
        : null;
    },
    refreshForRequest: () => coordinatedRefresh(true),
    async rebootstrap() {
      try {
        await bootstrap(true, true);
      } catch (error) {
        const normalized = toAppError(error);
        if (normalized.kind === "forbidden") {
          dispatch(
            {
              type: "DENIED",
              message: "Seu acesso a esta organização mudou.",
            },
            true,
          );
        }
        throw normalized;
      }
    },
    async expireSession() {
      try {
        await explicitCookieOperation(() => dependencies.authApi.logout());
      } catch {
        // Expiração local não depende do melhor esforço remoto.
      }
      await clearAuthenticatedMaterial();
      post({ type: "session-expired", generation: observedGeneration });
      dispatch(
        {
          type: "EXPIRED",
          message: "Sua sessão expirou. Entre novamente.",
        },
        true,
      );
    },
    setLifecycleListener(listener) {
      lifecycleListeners.add(listener);
      return () => lifecycleListeners.delete(listener);
    },
    dispose() {
      disposed = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onResume);
        window.removeEventListener("pageshow", onResume);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      unsubscribeChannel();
      dependencies.channel.close();
      listeners.clear();
      lifecycleListeners.clear();
    },
  };
}
