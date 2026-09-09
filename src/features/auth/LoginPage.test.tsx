import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import { server } from "@/test/msw/server";
import { createAuthHandlers, testUser } from "@/test/msw/auth-handlers";

describe("LoginPage", () => {
  it("valida os campos e foca o primeiro erro", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveFocus();
    expect(screen.getByText("Informe sua senha.")).toBeVisible();
  });

  it("rejeita formato inválido de e-mail", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");
    await user.type(screen.getByLabelText("E-mail"), "email-invalido");
    await user.type(screen.getByLabelText("Senha"), "senha-local");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail inválido.")).toBeVisible();
  });

  it("oferece recuperação e alterna a visibilidade da senha", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("link", { name: "Esqueci minha senha" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("mostra sucesso somente para o search param validado", async () => {
    await renderAppAt("/login?passwordReset=true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Senha alterada com sucesso.",
    );
  });

  it("faz login real, limpa senha e entra no shell protegido", async () => {
    server.use(...createAuthHandlers());
    const user = userEvent.setup();
    await renderAppAt("/login?returnTo=%2Fapp%2Fpipeline");

    await user.type(screen.getByLabelText("E-mail"), testUser.email);
    await user.type(screen.getByLabelText("Senha"), "senha-de-teste");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByRole("heading", { name: /^Pipeline$/u }),
    ).toBeVisible();
    expect(
      screen.queryByDisplayValue("senha-de-teste"),
    ).not.toBeInTheDocument();
  });

  it("usa mensagem genérica e limpa senha para credencial inválida", async () => {
    server.use(...createAuthHandlers({ loginStatus: 401 }));
    const user = userEvent.setup();
    await renderAppAt("/login");

    await user.type(screen.getByLabelText("E-mail"), testUser.email);
    await user.type(screen.getByLabelText("Senha"), "senha-incorreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha inválidos.",
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("encaminha senha correta de conta não verificada sem criar sessão", async () => {
    window.sessionStorage.clear();
    server.use(...createAuthHandlers({ loginVerificationRequired: true }));
    const user = userEvent.setup();
    const { router } = await renderAppAt("/login");
    await user.type(screen.getByLabelText("E-mail"), testUser.email);
    await user.type(screen.getByLabelText("Senha"), "senha-de-teste");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(
      await screen.findByRole("heading", { name: "Confirme seu e-mail" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/verify-email");
    expect(
      window.sessionStorage.getItem("genesis.emailVerification.v1"),
    ).not.toContain("senha-de-teste");
  });
});
