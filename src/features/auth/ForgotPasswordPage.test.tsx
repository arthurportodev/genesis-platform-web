import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import { createAuthHandlers } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("mantém o contexto somente em memória e conclui sem login automático", async () => {
    server.use(...createAuthHandlers());
    const user = userEvent.setup();
    const { router } = await renderAppAt("/forgot-password");

    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.test");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(
      await screen.findByText(/Se existir uma conta ativa/iu),
    ).toBeVisible();
    expect(screen.getByText(/pessoa@example\.test/iu)).toBeVisible();
    expect(storageContents(window.localStorage)).not.toContain(
      "pessoa@example.test",
    );
    expect(storageContents(window.sessionStorage)).not.toContain(
      "pessoa@example.test",
    );

    await user.type(screen.getByLabelText("Código"), "123456");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-local");
    await user.type(
      screen.getByLabelText("Confirmar nova senha"),
      "nova-senha-local",
    );
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));

    expect(
      await screen.findByText("Senha alterada com sucesso."),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({ passwordReset: true });
    expect(storageContents(window.localStorage)).not.toContain(
      "nova-senha-local",
    );
    expect(storageContents(window.sessionStorage)).not.toContain(
      "nova-senha-local",
    );
  });

  it("valida confirmação e traduz o erro opaco de conclusão", async () => {
    server.use(...createAuthHandlers({ passwordResetCompleteStatus: 400 }));
    const user = userEvent.setup();
    await renderAppAt("/forgot-password");
    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.test");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByLabelText("Código");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-local");
    await user.type(
      screen.getByLabelText("Confirmar nova senha"),
      "senha-diferente",
    );
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("As senhas não coincidem.")).toBeVisible();

    await user.clear(screen.getByLabelText("Confirmar nova senha"));
    await user.type(
      screen.getByLabelText("Confirmar nova senha"),
      "nova-senha-local",
    );
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(
      await screen.findByText(/Código inválido ou expirado/iu),
    ).toBeVisible();
    expect(screen.getByLabelText("Código")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("");
  });
});

function storageContents(storage: Storage): string {
  return Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index) ?? "";
    return `${key}:${storage.getItem(key) ?? ""}`;
  }).join("|");
}
