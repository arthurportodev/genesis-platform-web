import type {
  Organization,
  PublicUser,
} from "@/features/auth/api/auth-contracts";

export interface AuthenticatedSessionData {
  user: PublicUser;
  organizations: readonly Organization[];
  activeOrganization: Organization | null;
}

export type SessionState =
  | { status: "initializing"; message: string }
  | { status: "anonymous"; message?: string }
  | { status: "authenticating"; message?: string }
  | { status: "refreshing"; message: string }
  | ({
      status: "authenticated-without-organization";
      reason: "none-available" | "selection-required";
    } & AuthenticatedSessionData)
  | ({
      status: "authenticated-with-organization";
    } & AuthenticatedSessionData)
  | ({
      status: "switching-organization";
      targetOrganizationId: string;
    } & AuthenticatedSessionData)
  | ({ status: "logging-out"; message: string } & AuthenticatedSessionData)
  | { status: "session-expired"; message: string }
  | { status: "access-denied"; message: string }
  | { status: "fatal-error"; message: string; retryable: boolean };

export type SessionEvent =
  | { type: "INITIALIZE" }
  | { type: "LOGIN" }
  | { type: "REFRESH" }
  | {
      type: "AUTHENTICATED";
      data: AuthenticatedSessionData;
      reason?: "none-available" | "selection-required";
    }
  | { type: "SWITCH"; targetOrganizationId: string }
  | { type: "LOGOUT" }
  | { type: "ANONYMOUS"; message?: string }
  | { type: "EXPIRED"; message: string }
  | { type: "DENIED"; message: string }
  | { type: "FATAL"; message: string; retryable: boolean };

const authenticatedStatuses = new Set<SessionState["status"]>([
  "authenticated-without-organization",
  "authenticated-with-organization",
  "switching-organization",
  "logging-out",
]);

function authenticatedData(state: SessionState): AuthenticatedSessionData {
  if (!authenticatedStatuses.has(state.status)) {
    throw new Error(`Transição inválida a partir de ${state.status}.`);
  }
  const authenticated = state as SessionState & AuthenticatedSessionData;
  return {
    user: authenticated.user,
    organizations: authenticated.organizations,
    activeOrganization: authenticated.activeOrganization,
  };
}

export const initialSessionState: SessionState = {
  status: "initializing",
  message: "Verificando sua sessão…",
};

export function reduceSession(
  state: SessionState,
  event: SessionEvent,
): SessionState {
  switch (event.type) {
    case "INITIALIZE":
      return initialSessionState;
    case "LOGIN":
      return { status: "authenticating" };
    case "REFRESH":
      return { status: "refreshing", message: "Renovando sua sessão…" };
    case "AUTHENTICATED":
      return event.data.activeOrganization
        ? { status: "authenticated-with-organization", ...event.data }
        : {
            status: "authenticated-without-organization",
            ...event.data,
            reason: event.reason ?? "selection-required",
          };
    case "SWITCH":
      return {
        status: "switching-organization",
        ...authenticatedData(state),
        targetOrganizationId: event.targetOrganizationId,
      };
    case "LOGOUT":
      return {
        status: "logging-out",
        ...authenticatedData(state),
        message: "Encerrando sua sessão…",
      };
    case "ANONYMOUS":
      return { status: "anonymous", message: event.message };
    case "EXPIRED":
      return { status: "session-expired", message: event.message };
    case "DENIED":
      return { status: "access-denied", message: event.message };
    case "FATAL":
      return {
        status: "fatal-error",
        message: event.message,
        retryable: event.retryable,
      };
  }
}

export function isAuthenticatedState(
  state: SessionState,
): state is SessionState & AuthenticatedSessionData {
  return authenticatedStatuses.has(state.status);
}
