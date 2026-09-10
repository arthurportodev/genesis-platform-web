import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderAppAt } from "@/test/renderApp";
import { createAuthHandlers } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";

describe("RegisterPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    server.use(...createAuthHandlers());
  });

  it("renders the official Google button when public config is enabled", async () => {
    installGoogleButton();
    server.use(
      http.get("/api/v1/auth/google/config", () =>
        HttpResponse.json({
          enabled: true,
          clientId: "public.apps.googleusercontent.com",
        }),
      ),
      http.post("/api/v1/auth/google/challenge", () =>
        HttpResponse.json(
          {
            challengeToken: "c".repeat(43),
            nonce: "n".repeat(43),
            expiresAt: "2030-01-01T00:05:00.000Z",
          },
          { status: 201 },
        ),
      ),
    );
    await renderAppAt("/register");
    expect(
      await screen.findByRole("button", { name: "Continuar com Google" }),
    ).toBeVisible();
  });

  it("valida os quatro campos sem enviar credenciais", async () => {
    const user = userEvent.setup();
    await renderAppAt("/register");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Informe seu nome.")).toBeVisible();
    expect(screen.getByText("Informe seu sobrenome.")).toBeVisible();
    expect(screen.getByText("Informe seu e-mail.")).toBeVisible();
    expect(screen.getByText("Use pelo menos 10 caracteres.")).toBeVisible();
  });

  it("bloqueia senhas diferentes antes da chamada HTTP", async () => {
    const user = userEvent.setup();
    await renderAppAt("/register");
    await user.type(screen.getByLabelText("Nome"), "Pessoa");
    await user.type(screen.getByLabelText("Sobrenome"), "Teste");
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.test");
    await user.type(screen.getByLabelText("Senha"), "senha-segura-local");
    await user.type(
      screen.getByLabelText("Confirmar senha"),
      "senha-diferente",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("As senhas não coincidem.")).toBeVisible();
  });

  it("cria a conta, limpa a senha e segue para o código", async () => {
    server.use(...createAuthHandlers());
    const user = userEvent.setup();
    const { router } = await renderAppAt("/register");
    await user.type(screen.getByLabelText("Nome"), "Pessoa");
    await user.type(screen.getByLabelText("Sobrenome"), "Teste");
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.test");
    await user.type(screen.getByLabelText("Senha"), "senha-segura-local");
    await user.type(
      screen.getByLabelText("Confirmar senha"),
      "senha-segura-local",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(
      await screen.findByRole("heading", { name: "Confirme seu e-mail" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/verify-email");
    expect(
      window.sessionStorage.getItem("genesis.emailVerification.v1"),
    ).not.toContain("senha-segura-local");
  });

  it("explica conflito sem preservar a senha", async () => {
    server.use(...createAuthHandlers({ registerStatus: 409 }));
    const user = userEvent.setup();
    await renderAppAt("/register");
    await user.type(screen.getByLabelText("Nome"), "Pessoa");
    await user.type(screen.getByLabelText("Sobrenome"), "Teste");
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.test");
    await user.type(screen.getByLabelText("Senha"), "senha-segura-local");
    await user.type(
      screen.getByLabelText("Confirmar senha"),
      "senha-segura-local",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma conta com este e-mail.",
    );
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar senha")).toHaveValue("");
  });
});

function installGoogleButton() {
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(),
        renderButton: vi.fn((parent: HTMLElement) => {
          const button = document.createElement("button");
          button.textContent = "Continuar com Google";
          parent.append(button);
        }),
      },
    },
  };
}
