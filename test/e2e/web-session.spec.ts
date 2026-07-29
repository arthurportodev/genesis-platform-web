import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Touch target não está visível.");
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function resetServer(page: Page) {
  await page.request.post("/__test/reset");
}

async function serverState(page: Page): Promise<{
  refreshCount: number;
  activeRefreshTokens: number;
}> {
  const response = await page.request.get("/__test/state");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("refreshCount" in value) ||
    typeof value.refreshCount !== "number" ||
    !("activeRefreshTokens" in value) ||
    typeof value.activeRefreshTokens !== "number"
  ) {
    throw new Error("Estado inválido do servidor E2E.");
  }
  return {
    refreshCount: value.refreshCount,
    activeRefreshTokens: value.activeRefreshTokens,
  };
}

async function login(
  page: Page,
  email = "owner@example.test",
  returnTo?: string,
) {
  await page.goto(
    returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login",
  );
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("correct-horse");
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function preparePipelineMove(page: Page) {
  const trigger = page.getByRole("button", {
    name: /Mover Lead Exemplo para outra etapa/iu,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const destination = page.getByRole("menuitem", { name: "Proposta" });
  await expectTouchTarget(destination);
  await destination.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Confirmar mudança de etapa",
  });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.beforeEach(async ({ page }) => {
  await resetServer(page);
});

test("login real protege deep link sem flash do shell", async ({ page }) => {
  await page.goto("/app/pipeline");
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toHaveCount(0);
  await page.getByLabel("E-mail").fill("owner@example.test");
  await page.getByLabel("Senha").fill("correct-horse");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/app\/pipeline$/u);
  await expect(
    page.getByRole("heading", { name: "Pipeline", exact: true }),
  ).toBeVisible();
});

test("reload restaura sessão por cookie HttpOnly", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/app$/u);
  const cookies = await page.context().cookies();
  expect(
    cookies.find(({ name }) => name === "genesis_refresh_dev")?.httpOnly,
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  expect((await serverState(page)).refreshCount).toBe(1);
});

test("duas páginas sem token compartilham uma única rotação", async ({
  browser,
  page,
}) => {
  await login(page);
  await page.close();
  const context = await browser.newContext();
  const seed = await context.newPage();
  await seed.goto("/login");
  await seed.getByLabel("E-mail").fill("owner@example.test");
  await seed.getByLabel("Senha").fill("correct-horse");
  await seed.getByRole("button", { name: "Entrar" }).click();
  await expect(seed).toHaveURL(/\/app$/u);
  await seed.close();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto("/app"), second.goto("/app")]);
  await expect(
    first.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  expect((await serverState(first)).refreshCount).toBe(1);
  await context.close();
});

test("nova aba adota token efêmero de peer sem refresh", async ({ page }) => {
  await login(page);
  const second = await page.context().newPage();
  await second.goto("/app");
  await expect(
    second.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  expect((await serverState(page)).refreshCount).toBe(0);
});

test("fallback sem Web Locks não executa refresh automático", async ({
  page,
}) => {
  await login(page);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "locks", {
      configurable: true,
      get: () => undefined,
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  expect((await serverState(page)).refreshCount).toBe(0);
});

test("seleção e troca de Organization funcionam por teclado", async ({
  page,
}) => {
  await login(page, "multi@example.test");
  await expect(
    page.getByRole("heading", { name: "Selecione uma organização" }),
  ).toBeVisible();
  const first = page.getByRole("button", {
    name: /Genesis Teste.*Papel: owner/iu,
  });
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(
    page.getByRole("button", { name: "Selecionar organização" }),
  ).toContainText("Segunda Organização");
});

test("zero Organization é estado autenticado válido e bloqueia o shell", async ({
  page,
}) => {
  await login(page, "zero@example.test");
  await expect(
    page.getByRole("heading", { name: "Selecione uma organização" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma organização disponível")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
});

test("refresh 401 encerra sessão sem tratar falha de rede como expiração", async ({
  browser,
  page,
}) => {
  await login(page);
  const cookies = await page.context().cookies();
  await page.request.post("/__test/expire");
  await page.close();
  const isolatedContext = await browser.newContext();
  await isolatedContext.addCookies(cookies);
  const isolatedPage = await isolatedContext.newPage();
  await isolatedPage.goto("/app");
  await expect(
    isolatedPage.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(isolatedPage.getByText(/sessão expirou/iu)).toBeVisible();
  await isolatedContext.close();
});

test("reuse de refresh revoga a família rotacionada", async ({ page }) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  const originalCookies = await page.context().cookies();
  const originalRefresh = originalCookies.find(
    ({ name }) => name === "genesis_refresh_dev",
  )?.value;
  const csrf = originalCookies.find(
    ({ name }) => name === "genesis_csrf_dev",
  )?.value;
  expect(originalRefresh).toBeTruthy();
  expect(csrf).toBeTruthy();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  const reuse = await fetch("http://127.0.0.1:4173/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      Cookie: `genesis_refresh_dev=${originalRefresh}; genesis_csrf_dev=${csrf}`,
      "X-CSRF-Token": csrf ?? "",
    },
  });
  expect(reuse.status).toBe(401);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(page.getByText(/sessão expirou/iu)).toBeVisible();
});

test("logout-all usa ação distinta e remove a sessão local", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page
    .getByRole("menuitem", { name: "Sair de todos os dispositivos" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  expect((await serverState(page)).activeRefreshTokens).toBe(0);
});

test("logout propaga para outra aba e botão voltar não revela shell", async ({
  page,
}) => {
  await login(page);
  const second = await page.context().newPage();
  await second.goto("/app");
  await expect(
    second.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toHaveCount(0);
});

test("menu mobile mantém labels, foco e navegação", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const trigger = page.getByRole("button", {
    name: "Abrir menu",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Menu principal" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Leads" }).click();
  await expect(
    page.getByRole("heading", { name: "Inbox de Leads" }),
  ).toBeVisible();
});

test("Inbox busca e abre o detalhe operacional", async ({ page }) => {
  await login(page, "owner@example.test", "/app/leads");
  await expect(
    page.getByRole("heading", { name: "Inbox de Leads" }),
  ).toBeVisible();
  await page.getByLabel("Buscar").fill("Lead Exemplo");
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  await page.getByRole("link", { name: "Lead Exemplo" }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`/app/leads/${leadIdForTest()}$`, "u"),
  );
  await expect(page.getByText("Histórico em ordem cronológica")).toBeVisible();
  await page.getByLabel("Conteúdo da nota").fill("Contato E2E");
  await page.getByRole("button", { name: "Adicionar nota" }).click();
  await expect(page.getByText("Nota adicionada.")).toBeVisible();
});

test("troca de Organization não exibe Leads do tenant anterior", async ({
  page,
}) => {
  await login(page, "multi@example.test");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.getByRole("link", { name: "Leads" }).first().click();
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(page.getByText("Lead Segunda").first()).toBeVisible();
  await expect(page.getByText("Lead Exemplo")).toHaveCount(0);
});

test("conflito de versão preserva o rascunho", async ({ page }) => {
  await page.request.post("/__test/lead-conflict");
  await login(page, "owner@example.test", `/app/leads/${leadIdForTest()}`);
  const note = page.getByLabel("Conteúdo da nota");
  await note.fill("Rascunho E2E");
  await page.getByRole("button", { name: "Adicionar nota" }).click();
  await expect(page.getByText(/rascunho foi preservado/iu)).toBeVisible();
  await expect(note).toHaveValue("Rascunho E2E");
});

test("Pipeline desktop busca, pagina uma coluna e volta do detalhe", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/pipeline");
  await expect(
    page.getByRole("heading", { name: "Pipeline", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("pipeline-desktop-board")).toBeVisible();
  for (const stage of [
    "Novo",
    "Qualificação",
    "Diagnóstico",
    "Proposta",
    "Negociação",
  ]) {
    await expect(page.getByRole("heading", { name: stage })).toBeVisible();
  }
  await expect(page.getByText("1 de 2 carregados")).toBeVisible();
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await expect(page.getByText("Lead Continuação")).toBeVisible();
  await page.getByLabel("Buscar").fill("Lead Exemplo");
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  await page
    .getByRole("article", { name: "Lead Exemplo", exact: true })
    .getByRole("link", { name: "Abrir detalhe" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/app/leads/${leadIdForTest()}$`, "u"),
  );
  await page.getByRole("link", { name: "Voltar para o Pipeline" }).click();
  await expect(page).toHaveURL(/\/app\/pipeline$/u);
  await expect(page.getByLabel("Buscar")).toHaveValue("Lead Exemplo");
  await page.getByRole("link", { name: "Leads", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inbox de Leads" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Abrir Lead Exemplo" }).click();
  await expect(
    page.getByRole("link", { name: "Voltar para a Inbox" }),
  ).toBeVisible();
});

test("Pipeline mobile mostra uma coluna, filtros em Sheet e touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "owner@example.test", "/app/pipeline");
  await expect(page.getByTestId("pipeline-desktop-board")).toBeHidden();
  const stage = page.getByLabel("Etapa exibida");
  await expectTouchTarget(stage);
  await stage.selectOption("qualification");
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  const filters = page.getByRole("button", { name: "Filtros" });
  await expectTouchTarget(filters);
  await expectTouchTarget(page.getByRole("button", { name: "Atualizar" }));
  await expectTouchTarget(
    page.getByRole("button", { name: /Mover Lead Exemplo/iu }),
  );
  await filters.click();
  const sheet = page.getByRole("dialog", { name: "Filtros do Pipeline" });
  await expect(sheet).toBeVisible();
  for (const control of [
    sheet.getByLabel("Buscar"),
    sheet.getByLabel("Responsável"),
    sheet.getByLabel("Origem"),
    sheet.getByLabel("Próxima ação"),
    sheet.getByRole("button", { name: "Limpar" }),
    sheet.getByRole("button", { name: "Ver Pipeline" }),
  ]) {
    await expectTouchTarget(control);
  }
});

test("move server-confirmed por teclado e posiciona foco no destino", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/pipeline");
  const { dialog } = await preparePipelineMove(page);
  const confirm = dialog.getByRole("button", { name: "Confirmar movimento" });
  await expectTouchTarget(confirm);
  await expectTouchTarget(dialog.getByRole("button", { name: "Cancelar" }));
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Lead movido com sucesso.")).toBeVisible();
  await expect(
    page.locator('[data-pipeline-column-heading="proposal"]:visible'),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: /Mover Lead Exemplo/iu }),
  ).toBeEnabled();
});

for (const status of [409, 412] as const) {
  test(`conflito ${status} não repete e devolve foco ao card`, async ({
    page,
  }) => {
    await page.request.post(`/__test/pipeline-conflict-${status}`);
    await login(page, "owner@example.test", "/app/pipeline");
    const { trigger, dialog } = await preparePipelineMove(page);
    await dialog.getByRole("button", { name: "Confirmar movimento" }).click();
    await expect(
      page.getByText(
        status === 412
          ? /atualizado por outra operação/iu
          : /estágio ou o estado deste Lead mudou/iu,
      ),
    ).toBeVisible();
    await expect(trigger).toBeFocused();
  });
}

test("resultado remoto incerto repete a mesma intenção sem optimistic update", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/pipeline");
  let firstMove = true;
  await page.route("**/api/v1/leads/*/move", async (route) => {
    if (firstMove) {
      firstMove = false;
      await route.abort("connectionrefused");
      return;
    }
    await route.continue();
  });
  const { dialog } = await preparePipelineMove(page);
  await dialog.getByRole("button", { name: "Confirmar movimento" }).click();
  await expect(
    page.getByText(/não foi possível confirmar o resultado remoto/iu),
  ).toBeVisible();
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Lead movido com sucesso.")).toBeVisible();
  await page.unroute("**/api/v1/leads/*/move");
});

test("Pipeline troca Organization sem flash e logout remove o board", async ({
  page,
}) => {
  await login(page, "multi@example.test", "/app/pipeline");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.getByRole("link", { name: "Pipeline" }).click();
  await expect(page.getByText("Lead Exemplo").first()).toBeVisible();
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(page.getByText("Lead Segunda").first()).toBeVisible();
  await expect(page.getByText("Lead Exemplo")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pipeline de Leads" }),
  ).toHaveCount(0);
});

function leadIdForTest(): string {
  return "00000000-0000-4000-8000-000000000010";
}
