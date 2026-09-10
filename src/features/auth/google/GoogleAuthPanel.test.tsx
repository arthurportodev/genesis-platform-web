import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SessionContext } from "@/features/auth/session/session-context";
import type { SessionCoordinator } from "@/features/auth/session/session-coordinator";
import { AppError } from "@/shared/api/errors";
import { GoogleAuthPanel } from "./GoogleAuthPanel";

const googleIdentity = vi.hoisted(() => ({
  isIosUnsupported: vi.fn(() => false),
  load: vi.fn(() => Promise.resolve()),
}));

vi.mock("./google-identity", () => ({
  isIosGooglePopupUnsupported: googleIdentity.isIosUnsupported,
  loadGoogleIdentityServices: googleIdentity.load,
}));

describe("GoogleAuthPanel", () => {
  let googleApi: ReturnType<typeof installGoogleButton>;

  beforeEach(() => {
    googleIdentity.isIosUnsupported.mockReturnValue(false);
    googleIdentity.load.mockResolvedValue(undefined);
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/login");
    googleApi = installGoogleButton();
  });

  afterEach(() => {
    delete window.google;
  });

  it("keeps the panel and GIS hidden when public config is disabled", async () => {
    const getGoogleConfig = vi.fn().mockResolvedValue({
      enabled: false,
      clientId: null,
    });
    const session = createSession({
      getGoogleConfig,
    });
    renderPanel(session);
    await waitFor(() => expect(getGoogleConfig).toHaveBeenCalledOnce());
    expect(
      screen.queryByLabelText("Acesso com Google"),
    ).not.toBeInTheDocument();
    expect(googleIdentity.load).not.toHaveBeenCalled();
  });

  it("shows an accessible config failure and retries", async () => {
    const getGoogleConfig = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ enabled: false, clientId: null });
    const session = createSession({ getGoogleConfig });
    renderPanel(session);
    expect(
      await screen.findByText(
        "O acesso com Google está temporariamente indisponível.",
      ),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar Google novamente" }),
    );
    await waitFor(() => expect(getGoogleConfig).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Acesso com Google"),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders loading, recovers from a GIS failure, and wires popup nonce", async () => {
    googleIdentity.load
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce(undefined);
    const session = createSession();
    renderPanel(session);
    expect(screen.getByText("Carregando acesso com Google…")).toBeVisible();
    await screen.findByText(
      "O acesso com Google está temporariamente indisponível.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar Google novamente" }),
    );
    await waitFor(() => expect(googleIdentity.load).toHaveBeenCalledTimes(2));
    expect(googleApi.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        client_id: "public.apps.googleusercontent.com",
        nonce: "n".repeat(43),
        ux_mode: "popup",
        auto_select: false,
      }),
    );
  });

  it("authenticates, delegates bootstrap navigation, and keeps secrets out of URL/storage", async () => {
    const credential = "signed.google.credential";
    const authenticateWithGoogle = vi.fn().mockResolvedValue(undefined);
    const session = createSession({ authenticateWithGoogle });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    renderPanel(session, { onAuthenticated });
    await clickRenderedGoogleButton(credential);
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(authenticateWithGoogle).toHaveBeenCalledWith({
      challengeToken: "c".repeat(43),
      credential,
    });
    expect(location.href).not.toContain(credential);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(credential);
    expect(JSON.stringify({ ...localStorage })).not.toContain(credential);
  });

  it("completes profile continuation and supports explicit cancellation", async () => {
    const completeGoogleProfile = vi.fn().mockResolvedValue(undefined);
    const issueGoogleChallenge = vi.fn().mockResolvedValue({
      challengeToken: "c".repeat(43),
      nonce: "n".repeat(43),
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
    const session = createSession({
      authenticateWithGoogle: vi
        .fn()
        .mockRejectedValue(googleContinuation("AUTH_GOOGLE_PROFILE_REQUIRED")),
      completeGoogleProfile,
      issueGoogleChallenge,
    });
    renderPanel(session);
    await clickRenderedGoogleButton("profile.credential.value");
    await screen.findByText("Complete seu nome para criar sua conta.");
    await userEvent.type(screen.getByLabelText("Nome"), "Pessoa");
    await userEvent.type(screen.getByLabelText("Sobrenome"), "Google");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() =>
      expect(completeGoogleProfile).toHaveBeenCalledWith({
        challengeToken: "c".repeat(43),
        firstName: "Pessoa",
        lastName: "Google",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(issueGoogleChallenge).toHaveBeenCalledTimes(2));
  });

  it("requires password proof, handles a wrong password, and retries safely", async () => {
    const linkGoogleIdentity = vi
      .fn()
      .mockRejectedValueOnce(
        new AppError("unauthorized", "Invalid credentials."),
      )
      .mockResolvedValueOnce(undefined);
    const session = createSession({
      authenticateWithGoogle: vi
        .fn()
        .mockRejectedValue(googleContinuation("AUTH_GOOGLE_LINK_REQUIRED")),
      linkGoogleIdentity,
    });
    renderPanel(session);
    await clickRenderedGoogleButton("link.credential.value");
    await screen.findByText(/Confirme sua senha/u);
    const password = screen.getByLabelText("Senha atual");
    await userEvent.type(password, "wrong-password-value");
    await userEvent.click(
      screen.getByRole("button", { name: "Conectar Google e entrar" }),
    );
    await screen.findByText("Não foi possível confirmar suas credenciais.");
    expect(password).toHaveValue("");
    await userEvent.type(password, "current-password-value");
    await userEvent.click(
      screen.getByRole("button", { name: "Conectar Google e entrar" }),
    );
    await waitFor(() => expect(linkGoogleIdentity).toHaveBeenCalledTimes(2));
  });

  it("hands the existing OTP continuation to the verified email flow", async () => {
    const onVerificationRequired = vi.fn().mockResolvedValue(undefined);
    const session = createSession({
      authenticateWithGoogle: vi.fn().mockRejectedValue(
        new AppError("forbidden", "Verification required.", {
          code: "EMAIL_VERIFICATION_REQUIRED",
          continuation: {
            challengeId: "11111111-1111-4111-8111-111111111111",
            expiresAt: "2030-01-01T00:05:00.000Z",
            resendAvailableAt: "2030-01-01T00:01:00.000Z",
          },
        }),
      ),
    });
    renderPanel(session, { onVerificationRequired });
    await clickRenderedGoogleButton("external.credential.value");
    await waitFor(() => expect(onVerificationRequired).toHaveBeenCalledOnce());
    const stored = sessionStorage.getItem("genesis.emailVerification.v1") ?? "";
    expect(stored).toContain("11111111-1111-4111-8111-111111111111");
    expect(stored).not.toContain("external.credential.value");
  });
});

function createSession(overrides: Partial<SessionCoordinator> = {}) {
  const anonymousState = { status: "anonymous" as const };
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => anonymousState,
    getGoogleConfig: vi.fn().mockResolvedValue({
      enabled: true,
      clientId: "public.apps.googleusercontent.com",
    }),
    issueGoogleChallenge: vi.fn().mockResolvedValue({
      challengeToken: "c".repeat(43),
      nonce: "n".repeat(43),
      expiresAt: "2030-01-01T00:05:00.000Z",
    }),
    authenticateWithGoogle: vi.fn().mockResolvedValue(undefined),
    completeGoogleProfile: vi.fn().mockResolvedValue(undefined),
    linkGoogleIdentity: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as SessionCoordinator;
}

function renderPanel(
  session: SessionCoordinator,
  callbacks: {
    onAuthenticated?: () => Promise<void>;
    onVerificationRequired?: () => Promise<void>;
  } = {},
) {
  render(
    <SessionContext.Provider value={session}>
      <GoogleAuthPanel
        onAuthenticated={
          callbacks.onAuthenticated ?? vi.fn().mockResolvedValue(undefined)
        }
        onVerificationRequired={
          callbacks.onVerificationRequired ??
          vi.fn().mockResolvedValue(undefined)
        }
      />
    </SessionContext.Provider>,
  );
}

function installGoogleButton() {
  let callback: ((response: { credential?: string }) => void) | undefined;
  const initialize = vi.fn(
    (
      config: Parameters<
        NonNullable<Window["google"]>["accounts"]["id"]["initialize"]
      >[0],
    ) => {
      callback = config.callback;
    },
  );
  const renderButton = vi.fn((parent: HTMLElement) => {
    const action = document.createElement("button");
    action.textContent = "Continuar com Google";
    action.onclick = () =>
      callback?.({ credential: action.dataset.credential });
    parent.append(action);
  });
  window.google = {
    accounts: {
      id: {
        initialize,
        renderButton,
      },
    },
  };
  return { initialize, renderButton };
}

async function clickRenderedGoogleButton(credential: string) {
  const action = await screen.findByRole("button", {
    name: "Continuar com Google",
  });
  action.dataset.credential = credential;
  await userEvent.click(action);
}

function googleContinuation(
  code: "AUTH_GOOGLE_PROFILE_REQUIRED" | "AUTH_GOOGLE_LINK_REQUIRED",
) {
  return new AppError("conflict", "Continuation required.", {
    code,
    googleContinuation: {
      challengeToken: "c".repeat(43),
      expiresAt: "2030-01-01T00:05:00.000Z",
    },
  });
}
