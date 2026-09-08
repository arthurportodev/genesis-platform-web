import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { writeVerificationContinuation } from "@/features/auth/email-verification-storage";
import { renderAppAt } from "@/test/renderApp";
import { createAuthHandlers, testChallenge } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";

describe("VerifyEmailPage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("não chama a API sem contexto e oferece retorno", async () => {
    await renderAppAt("/verify-email");
    expect(
      await screen.findByRole("heading", { name: "Verificação indisponível" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Voltar ao login" })).toBeVisible();
  });

  it("mantém o contexto após código inválido", async () => {
    server.use(...createAuthHandlers());
    writeVerificationContinuation(testChallenge, "sent");
    const user = userEvent.setup();
    await renderAppAt("/verify-email");
    await user.type(screen.getByLabelText("Código de verificação"), "000000");
    await user.click(screen.getByRole("button", { name: "Verificar e-mail" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Código inválido ou expirado.",
    );
    expect(
      window.sessionStorage.getItem("genesis.emailVerification.v1"),
    ).not.toBeNull();
  });

  it("bloqueia o reenvio durante o cooldown", async () => {
    server.use(...createAuthHandlers());
    writeVerificationContinuation({
      ...testChallenge,
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await renderAppAt("/verify-email");

    expect(screen.getByRole("button", { name: /Reenviar em/u })).toBeDisabled();
  });

  it("substitui atomicamente o challenge após reenvio", async () => {
    server.use(...createAuthHandlers());
    writeVerificationContinuation(testChallenge, "sent");
    const user = userEvent.setup();
    await renderAppAt("/verify-email");
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Um novo código foi enviado.",
    );
    expect(
      JSON.parse(
        window.sessionStorage.getItem("genesis.emailVerification.v1") ?? "{}",
      ),
    ).toMatchObject({
      challengeId: "20000000-0000-4000-8000-000000000002",
    });
  });

  it("confirma sem login automático e limpa o contexto", async () => {
    server.use(...createAuthHandlers());
    writeVerificationContinuation(testChallenge, "sent");
    const user = userEvent.setup();
    const { router } = await renderAppAt("/verify-email");
    await user.type(screen.getByLabelText("Código de verificação"), "123456");
    await user.click(screen.getByRole("button", { name: "Verificar e-mail" }));
    expect(
      await screen.findByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("E-mail confirmado.");
    expect(router.state.location.pathname).toBe("/login");
    expect(
      window.sessionStorage.getItem("genesis.emailVerification.v1"),
    ).toBeNull();
  });
});
