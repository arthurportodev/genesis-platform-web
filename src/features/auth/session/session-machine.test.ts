import {
  initialSessionState,
  reduceSession,
} from "@/features/auth/session/session-machine";

const data = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Pessoa Teste",
    email: "pessoa@example.test",
    status: "active" as const,
  },
  organizations: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Organização Teste",
      slug: "organizacao-teste",
      membershipId: "00000000-0000-4000-8000-000000000003",
      role: "owner" as const,
    },
  ],
  activeOrganization: null,
};

describe("máquina de sessão", () => {
  it("representa estados discriminados sem combinações livres", () => {
    const authenticating = reduceSession(initialSessionState, {
      type: "LOGIN",
    });
    const authenticated = reduceSession(authenticating, {
      type: "AUTHENTICATED",
      data: { ...data, activeOrganization: data.organizations[0] },
    });
    const switching = reduceSession(authenticated, {
      type: "SWITCH",
      targetOrganizationId: data.organizations[0].id,
    });
    const loggingOut = reduceSession(switching, { type: "LOGOUT" });
    expect([
      initialSessionState.status,
      authenticating.status,
      authenticated.status,
      switching.status,
      loggingOut.status,
    ]).toEqual([
      "initializing",
      "authenticating",
      "authenticated-with-organization",
      "switching-organization",
      "logging-out",
    ]);
  });

  it("representa zero Organization e falhas distintas", () => {
    expect(
      reduceSession(initialSessionState, {
        type: "AUTHENTICATED",
        data,
        reason: "none-available",
      }),
    ).toMatchObject({
      status: "authenticated-without-organization",
      reason: "none-available",
    });
    expect(
      reduceSession(initialSessionState, {
        type: "EXPIRED",
        message: "expirada",
      }).status,
    ).toBe("session-expired");
    expect(
      reduceSession(initialSessionState, {
        type: "FATAL",
        message: "offline",
        retryable: true,
      }),
    ).toMatchObject({ status: "fatal-error", retryable: true });
  });

  it("rejeita troca sem contexto autenticado", () => {
    expect(() =>
      reduceSession(initialSessionState, {
        type: "SWITCH",
        targetOrganizationId: data.organizations[0].id,
      }),
    ).toThrow(/transição inválida/iu);
  });
});
