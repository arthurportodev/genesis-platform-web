import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderAppAt } from "@/test/renderApp";

describe("LoginPage", () => {
  it("exige o campo de e-mail", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");

    await user.type(screen.getByLabelText("Senha"), "senha-local");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu e-mail.")).toBeVisible();
  });

  it("rejeita formato inválido de e-mail", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");

    await user.type(screen.getByLabelText("E-mail"), "email-invalido");
    await user.type(screen.getByLabelText("Senha"), "senha-local");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail inválido.")).toBeVisible();
  });

  it("exige o campo de senha", async () => {
    const user = userEvent.setup();
    await renderAppAt("/login");

    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.com");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe sua senha.")).toBeVisible();
  });

  it("aceita o formulário válido sem chamar API ou armazenar autenticação", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    await renderAppAt("/login");

    await user.type(screen.getByLabelText("E-mail"), "pessoa@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-local");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText(/nenhuma credencial foi enviada/i),
    ).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(window.localStorage).toHaveLength(0);
  });
});
