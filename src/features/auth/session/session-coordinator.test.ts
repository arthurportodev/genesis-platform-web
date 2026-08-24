import { createSessionCoordinator } from "@/features/auth/session/session-coordinator";
import type {
  SessionChannel,
  SessionMessage,
} from "@/features/auth/session/session-channel";
import { AppError } from "@/shared/api/errors";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Pessoa Teste",
  email: "pessoa@example.test",
  status: "active" as const,
};
const organization = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Organização Teste",
  slug: "organizacao-teste",
  membershipId: "00000000-0000-4000-8000-000000000003",
  role: "owner" as const,
};
const fakeAccessToken = ["memory", "only", "access"].join("-");
const response = {
  accessToken: fakeAccessToken,
  tokenType: "Bearer" as const,
  expiresIn: 900,
  user,
};

function createHarness(
  options: {
    locks?: boolean;
    organizations?: (typeof organization)[];
    preferred?: string;
  } = {},
) {
  const listeners = new Set<(message: SessionMessage) => void>();
  const channel: SessionChannel = {
    available: false,
    post: vi.fn(),
    subscribe: vi.fn((listener: (message: SessionMessage) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    close: vi.fn(),
  };
  const authApi = {
    login: vi.fn().mockResolvedValue(response),
    refresh: vi.fn().mockResolvedValue(response),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    bootstrap: vi.fn().mockResolvedValue({
      user,
      organizations: options.organizations ?? [organization],
    }),
  };
  let preference: string | null = options.preferred ?? null;
  let currentTime = 1_000;
  let locksAvailable = options.locks ?? true;
  const cache = {
    cancelAndClearAuthenticated: vi.fn().mockResolvedValue(undefined),
    hasPendingMutations: vi.fn().mockReturnValue(false),
    cancelOrganization: vi.fn().mockResolvedValue(undefined),
    removeOrganization: vi.fn(),
  };
  const coordinator = createSessionCoordinator({
    authApi,
    cookieLock: {
      get available() {
        return locksAvailable;
      },
      run: <T>(operation: () => Promise<T>) => operation(),
    },
    channel,
    preference: {
      read: () => preference,
      write: (value) => {
        preference = value;
      },
      clear: () => {
        preference = null;
      },
    },
    cache,
    now: () => currentTime,
    tabId: "00000000-0000-4000-8000-000000000004",
    peerWaitMs: 0,
  });
  return {
    coordinator,
    authApi,
    cache,
    advance: (milliseconds: number) => {
      currentTime += milliseconds;
    },
    setLocksAvailable: (available: boolean) => {
      locksAvailable = available;
    },
    emit: (message: SessionMessage) => {
      for (const listener of listeners) listener(message);
    },
    preference: () => preference,
  };
}

describe("SessionCoordinator", () => {
  it("restaura por refresh, mantém access privado e resolve Organization única", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    expect(harness.authApi.refresh).toHaveBeenCalledOnce();
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "authenticated-with-organization",
      user,
      activeOrganization: organization,
    });
    expect(JSON.stringify(harness.coordinator.getSnapshot())).not.toContain(
      "memory-only-access",
    );
    expect(harness.coordinator.getAccessToken()).toBe("memory-only-access");
    expect(harness.preference()).toBe(organization.id);
  });

  it("usa uma única Promise para refresh simultâneo na aba", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    harness.advance(901_000);
    let resolveRefresh!: (value: typeof response) => void;
    harness.authApi.refresh.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const first = harness.coordinator.refreshForRequest();
    const second = harness.coordinator.refreshForRequest();
    await vi.waitFor(() => {
      expect(resolveRefresh).toBeTypeOf("function");
    });
    resolveRefresh(response);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(harness.authApi.refresh).toHaveBeenCalledTimes(2);
    expect(harness.coordinator.getSnapshot().status).toBe(
      "authenticated-with-organization",
    );
  });

  it("mantém a sessão montada durante refresh de request autenticado", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    const observedStatuses: string[] = [];
    const unsubscribe = harness.coordinator.subscribe(() => {
      observedStatuses.push(harness.coordinator.getSnapshot().status);
    });

    await expect(harness.coordinator.refreshForRequest()).resolves.toBe(true);

    unsubscribe();
    expect(observedStatuses).not.toContain("refreshing");
    expect(harness.coordinator.getSnapshot().status).toBe(
      "authenticated-with-organization",
    );
  });

  it("não faz refresh automático quando Web Locks está indisponível", async () => {
    const harness = createHarness({ locks: false });
    await harness.coordinator.initialize();
    expect(harness.authApi.refresh).not.toHaveBeenCalled();
    expect(harness.coordinator.getSnapshot().status).toBe("anonymous");
  });

  it("falha de rede no refresh é bloqueada e não vira sessão expirada", async () => {
    const harness = createHarness();
    harness.authApi.refresh.mockRejectedValueOnce(
      new AppError("network", "Serviço indisponível."),
    );
    await harness.coordinator.initialize();
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "fatal-error",
      retryable: true,
      message: "Serviço indisponível.",
    });
  });

  it("refresh 401 preserva evidência de sessão expirada", async () => {
    const harness = createHarness();
    harness.authApi.refresh.mockRejectedValueOnce(
      new AppError("unauthorized", "unauthorized"),
    );
    await harness.coordinator.initialize();
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "session-expired",
      message: "Sua sessão expirou. Entre novamente.",
    });
  });

  it("ignora logout antigo após adotar uma geração superior", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    harness.emit({
      version: 1,
      type: "logout",
      tabId: "00000000-0000-4000-8000-000000000099",
      generation: 0,
    });
    await Promise.resolve();
    expect(harness.coordinator.getSnapshot().status).toBe(
      "authenticated-with-organization",
    );
  });

  it("fecha o contexto local ao expirar sem Web Locks no resume", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    harness.advance(901_000);
    harness.setLocksAvailable(false);
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => {
      expect(harness.coordinator.getSnapshot()).toMatchObject({
        status: "anonymous",
        message:
          "Entre novamente neste navegador para continuar com segurança.",
      });
    });
    expect(harness.cache.cancelAndClearAuthenticated).toHaveBeenCalled();
  });

  it("limpa cache e preferência em logout", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    await harness.coordinator.logout();
    expect(harness.authApi.logout).toHaveBeenCalledOnce();
    expect(harness.cache.cancelAndClearAuthenticated).toHaveBeenCalledOnce();
    expect(harness.preference()).toBeNull();
    expect(harness.coordinator.getSnapshot().status).toBe("anonymous");
  });

  it("repete logout após falha de rede e invalida o lifecycle no sucesso", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    const lifecycle = vi.fn();
    harness.coordinator.setLifecycleListener(lifecycle);
    harness.authApi.logout
      .mockRejectedValueOnce(new AppError("network", "Sem conexão."))
      .mockResolvedValueOnce(undefined);

    await expect(harness.coordinator.logout()).rejects.toMatchObject({
      kind: "network",
    });
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "fatal-error",
      retryable: true,
    });
    await harness.coordinator.retry();
    expect(harness.authApi.logout).toHaveBeenCalledTimes(2);
    expect(harness.coordinator.getSnapshot().status).toBe("anonymous");
    expect(lifecycle).toHaveBeenCalledOnce();
  });

  it("aceita zero Organization sem criar tenant fictício", async () => {
    const harness = createHarness({ organizations: [] });
    await harness.coordinator.initialize();
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "authenticated-without-organization",
      reason: "none-available",
      organizations: [],
      activeOrganization: null,
    });
  });

  it("troca Organization cancelando e removendo o cache anterior", async () => {
    const second = {
      ...organization,
      id: "00000000-0000-4000-8000-000000000008",
      membershipId: "00000000-0000-4000-8000-000000000009",
      name: "Segunda Organização",
    };
    const harness = createHarness({
      organizations: [organization, second],
      preferred: organization.id,
    });
    await harness.coordinator.initialize();
    await harness.coordinator.selectOrganization(second.id);
    expect(harness.cache.cancelOrganization).toHaveBeenCalledWith(
      organization.id,
    );
    expect(harness.cache.removeOrganization).toHaveBeenCalledWith(
      organization.id,
    );
    expect(harness.coordinator.getActiveOrganizationId()).toBe(second.id);
  });

  it("bloqueia troca com mutation pendente e invalida lifecycle ao concluir", async () => {
    const second = {
      ...organization,
      id: "00000000-0000-4000-8000-000000000008",
      membershipId: "00000000-0000-4000-8000-000000000009",
      name: "Segunda Organização",
    };
    const harness = createHarness({
      organizations: [organization, second],
      preferred: organization.id,
    });
    await harness.coordinator.initialize();
    harness.cache.hasPendingMutations.mockReturnValueOnce(true);
    await expect(
      harness.coordinator.selectOrganization(second.id),
    ).rejects.toMatchObject({ kind: "conflict" });
    expect(harness.coordinator.getActiveOrganizationId()).toBe(organization.id);

    const lifecycle = vi.fn();
    harness.coordinator.setLifecycleListener(lifecycle);
    await harness.coordinator.selectOrganization(second.id);
    expect(lifecycle).toHaveBeenCalledOnce();
  });

  it("logout-all 401 limpa local sem afirmar revogação global", async () => {
    const harness = createHarness();
    harness.authApi.logoutAll.mockRejectedValueOnce(
      new AppError("unauthorized", "unauthorized"),
    );
    await harness.coordinator.initialize();
    await expect(harness.coordinator.logoutAll()).resolves.toEqual({
      globallyRevoked: false,
    });
    expect(harness.authApi.logout).toHaveBeenCalledOnce();
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "anonymous",
      message:
        "A sessão local foi encerrada, mas a revogação global não pôde ser confirmada.",
    });
  });

  it("preserva a intenção de logout-all durante retry", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    const lifecycle = vi.fn();
    harness.coordinator.setLifecycleListener(lifecycle);
    harness.authApi.logoutAll
      .mockRejectedValueOnce(new AppError("network", "Sem conexão."))
      .mockResolvedValueOnce(undefined);

    await expect(harness.coordinator.logoutAll()).rejects.toMatchObject({
      kind: "network",
    });
    await harness.coordinator.retry();
    expect(harness.authApi.logoutAll).toHaveBeenCalledTimes(2);
    expect(harness.coordinator.getSnapshot().status).toBe("anonymous");
    expect(lifecycle).toHaveBeenCalledOnce();
  });

  it("mantém retry quando bootstrap falha depois de refresh recuperado", async () => {
    const harness = createHarness();
    await harness.coordinator.initialize();
    harness.advance(901_000);
    harness.authApi.refresh.mockRejectedValueOnce(
      new AppError("network", "Sem conexão."),
    );
    await expect(harness.coordinator.refreshForRequest()).rejects.toMatchObject(
      { kind: "network" },
    );
    harness.authApi.bootstrap.mockRejectedValueOnce(
      new AppError("network", "Bootstrap indisponível."),
    );
    await expect(harness.coordinator.retry()).rejects.toMatchObject({
      kind: "network",
    });
    expect(harness.coordinator.getSnapshot()).toMatchObject({
      status: "fatal-error",
      retryable: true,
      message: "Bootstrap indisponível.",
    });
    await harness.coordinator.retry();
    expect(harness.coordinator.getSnapshot().status).toBe(
      "authenticated-with-organization",
    );
  });

  it("coordena duas abas com uma única rotação e propaga logout", async () => {
    const channelListeners = new Map<
      string,
      Set<(message: SessionMessage) => void>
    >();
    const channelFor = (id: string): SessionChannel => {
      const own = new Set<(message: SessionMessage) => void>();
      channelListeners.set(id, own);
      return {
        available: true,
        post(message) {
          for (const [channelId, listeners] of channelListeners) {
            if (channelId === id) continue;
            for (const listener of listeners)
              queueMicrotask(() => listener(message));
          }
        },
        subscribe(listener) {
          own.add(listener);
          return () => own.delete(listener);
        },
        close() {
          channelListeners.delete(id);
        },
      };
    };
    let lockTail = Promise.resolve();
    const lock = {
      available: true,
      async run<T>(operation: () => Promise<T>): Promise<T> {
        const previous = lockTail;
        let release!: () => void;
        lockTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation();
        } finally {
          release();
        }
      },
    };
    const authApi = {
      login: vi.fn().mockResolvedValue(response),
      refresh: vi.fn().mockResolvedValue(response),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      bootstrap: vi.fn().mockResolvedValue({
        user,
        organizations: [organization],
      }),
    };
    const makeCoordinator = (suffix: string) =>
      createSessionCoordinator({
        authApi,
        cookieLock: lock,
        channel: channelFor(suffix),
        preference: { read: () => null, write: vi.fn(), clear: vi.fn() },
        cache: {
          cancelAndClearAuthenticated: vi.fn().mockResolvedValue(undefined),
          hasPendingMutations: vi.fn().mockReturnValue(false),
          cancelOrganization: vi.fn().mockResolvedValue(undefined),
          removeOrganization: vi.fn(),
        },
        tabId: `00000000-0000-4000-8000-00000000000${suffix}`,
        peerWaitMs: 0,
      });
    const leader = makeCoordinator("6");
    const follower = makeCoordinator("7");

    await Promise.all([leader.initialize(), follower.initialize()]);
    expect(authApi.refresh).toHaveBeenCalledOnce();
    expect(leader.getAccessToken()).toBe("memory-only-access");
    expect(follower.getAccessToken()).toBe("memory-only-access");

    await leader.logout();
    await vi.waitFor(() => {
      expect(follower.getSnapshot().status).toBe("anonymous");
    });
    leader.dispose();
    follower.dispose();
  });
});
