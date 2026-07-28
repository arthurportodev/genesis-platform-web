import { expect, test, type Page } from "@playwright/test";

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
  page,
}) => {
  await login(page);
  await page.request.post("/__test/expire");
  const context = page.context();
  await page.close();
  const freshPage = await context.newPage();
  await freshPage.goto("/app");
  await expect(
    freshPage.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(freshPage.getByText(/sessão expirou/iu)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
});
