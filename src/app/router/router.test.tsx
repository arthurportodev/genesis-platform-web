import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import { server } from "@/test/msw/server";
import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
  testUser,
} from "@/test/msw/auth-handlers";
import { createLeadHandlers } from "@/test/msw/lead-handlers";

describe("router e shell protegidos", () => {
  it("encaminha a raiz autenticada para o CRM sem loop", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers());
    const { router } = await renderAppAt("/");

    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/app");
    restoreLocks();
  });

  it("encaminha a raiz anônima ao login com retorno para o CRM", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers({ refreshStatus: 401 }));
    const { router } = await renderAppAt("/");

    expect(
      await screen.findByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({ returnTo: "/app" });
    restoreLocks();
  });

  it("redireciona acesso anônimo e preserva returnTo seguro", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers({ refreshStatus: 401 }));
    const { router } = await renderAppAt("/app/leads");

    expect(
      await screen.findByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toEqual({ returnTo: "/app/leads" });
    restoreLocks();
  });

  it("restaura a sessão antes de renderizar o shell", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers());
    const { container } = await renderAppAt("/app");

    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Abrir menu do usuário" }));
    expect(await screen.findByText(testUser.name)).toBeInTheDocument();
    expect(container.textContent).not.toContain("ey.test.access");
    restoreLocks();
  });

  it("exige seleção quando existem várias Organizations sem preferência", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers({ organizations: testOrganizations }));
    const user = userEvent.setup();
    const { router } = await renderAppAt("/app");

    expect(
      await screen.findByRole("heading", { name: "Selecione uma organização" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Genesis Teste.*Papel: owner/iu }),
    );
    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/app");
    restoreLocks();
  });

  it("navega no shell e troca Organization limpando o contexto anterior", async () => {
    const restoreLocks = installWebLocks();
    window.localStorage.setItem(
      "genesis.activeOrganizationId.v1",
      testOrganizations[0].id,
    );
    server.use(...createAuthHandlers({ organizations: testOrganizations }));
    const user = userEvent.setup();
    await renderAppAt("/app");

    await user.click(
      await screen.findByRole("button", { name: "Selecionar organização" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Segunda Organização" }),
    );
    expect(
      screen.getByRole("button", { name: "Selecionar organização" }),
    ).toHaveTextContent("Segunda Organização");

    await user.click(screen.getAllByRole("link", { name: "Pipeline" })[0]);
    expect(
      await screen.findByRole("heading", { name: /^Pipeline$/u }),
    ).toBeVisible();
    restoreLocks();
  });

  it("abre o menu responsivo por teclado", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    const user = userEvent.setup();
    await renderAppAt("/app");

    const trigger = await screen.findByRole("button", { name: "Abrir menu" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const drawer = await screen.findByRole("dialog");
    await user.click(within(drawer).getByRole("link", { name: "Leads" }));
    expect(
      await screen.findByRole("heading", { name: "Inbox de Leads" }),
    ).toBeVisible();
    restoreLocks();
  });

  it("mantém not found público sem expor shell", async () => {
    await renderAppAt("/nao-existe");
    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Navegação principal" }),
    ).not.toBeInTheDocument();
  });
});
