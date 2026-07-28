import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { renderAppAt } from "@/test/renderApp";

describe("router e shell", () => {
  it("renderiza o shell sem chamada HTTP no carregamento inicial", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await renderAppAt("/app");

    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Navegação principal" }),
    ).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("navega entre placeholders administrativos", async () => {
    const user = userEvent.setup();
    await renderAppAt("/app");

    await user.click(screen.getAllByRole("link", { name: "Pipeline" })[0]);

    expect(
      await screen.findByRole("heading", { name: "Pipeline" }),
    ).toBeVisible();
    expect(screen.getByText("Pipeline sem dados")).toBeVisible();
  });

  it("preserva rotas profundas de lead sem buscar dados", async () => {
    await renderAppAt("/app/leads/lead-42");

    expect(
      await screen.findByRole("heading", { name: "Detalhes do lead" }),
    ).toBeVisible();
    expect(screen.getByText(/referência de rota: lead-42/i)).toBeVisible();
    expect(screen.getByText("Detalhes indisponíveis")).toBeVisible();
  });

  it("mostra seleção visual indisponível sem organização fictícia", async () => {
    await renderAppAt("/select-organization");

    expect(
      await screen.findByRole("heading", { name: "Selecione uma organização" }),
    ).toBeVisible();
    expect(
      screen.getByText("Organizações ainda não disponíveis"),
    ).toBeVisible();
  });

  it("expõe seletor de empresa acessível sem simular contexto", async () => {
    const user = userEvent.setup();
    await renderAppAt("/app");
    const trigger = screen.getByRole("button", { name: "Selecionar empresa" });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = await screen.findByRole("menu");
    expect(menu).toBeVisible();
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(screen.getByText("Integração pendente")).toBeVisible();
  });

  it("abre o menu responsivo e navega por ele", async () => {
    const user = userEvent.setup();
    await renderAppAt("/app");

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("link", { name: "Leads" }));

    expect(await screen.findByRole("heading", { name: "Leads" })).toBeVisible();
  });

  it("renderiza página 404 para endereço desconhecido", async () => {
    await renderAppAt("/nao-existe");

    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
  });
});
