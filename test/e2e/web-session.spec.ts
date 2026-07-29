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
  metricsRequests: number;
  createRequests: number;
  createKeyReused: boolean;
  createHadIfMatch: boolean;
}> {
  const response = await page.request.get("/__test/state");
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("refreshCount" in value) ||
    typeof value.refreshCount !== "number" ||
    !("activeRefreshTokens" in value) ||
    typeof value.activeRefreshTokens !== "number" ||
    !("metricsRequests" in value) ||
    typeof value.metricsRequests !== "number" ||
    !("createRequests" in value) ||
    typeof value.createRequests !== "number" ||
    !("createKeyReused" in value) ||
    typeof value.createKeyReused !== "boolean" ||
    !("createHadIfMatch" in value) ||
    typeof value.createHadIfMatch !== "boolean"
  ) {
    throw new Error("Estado inválido do servidor E2E.");
  }
  return {
    refreshCount: value.refreshCount,
    activeRefreshTokens: value.activeRefreshTokens,
    metricsRequests: value.metricsRequests,
    createRequests: value.createRequests,
    createKeyReused: value.createKeyReused,
    createHadIfMatch: value.createHadIfMatch,
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

test("owner cria Lead manual pela Inbox com contrato server-confirmed", async ({
  page,
}) => {
  const consoleMessages: string[] = [];
  page.on("console", (message) => consoleMessages.push(message.text()));
  await page.addInitScript(() => {
    const posted: string[] = [];
    Object.defineProperty(globalThis, "__leadTestBroadcastMessages", {
      configurable: true,
      value: posted,
    });
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      BroadcastChannel.prototype,
      "postMessage",
    );
    if (typeof originalDescriptor?.value !== "function")
      throw new Error("BroadcastChannel.postMessage indisponível.");
    const original = originalDescriptor.value as (
      this: object,
      message: unknown,
    ) => void;
    Object.defineProperty(BroadcastChannel.prototype, "postMessage", {
      configurable: true,
      value(this: object, message: unknown) {
        posted.push(JSON.stringify(message));
        return Reflect.apply(original, this, [message]);
      },
    });
  });
  await login(page, "owner@example.test", "/app/leads");
  await page.getByRole("link", { name: "Novo Lead" }).click();
  await expect(page).toHaveURL(/\/app\/leads\/new$/u);
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead E2E");
  const phone = page.getByRole("textbox", { name: /^Telefone/iu });
  await expect(phone).toHaveAttribute("type", "tel");
  await expect(phone).toHaveAttribute("inputmode", "tel");
  await phone.fill("62999999999");
  await page.getByRole("textbox", { name: "E-mail" }).fill("LEAD@EXAMPLE.TEST");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(page).toHaveURL(
    /\/app\/leads\/00000000-0000-4000-8000-000000000010$/u,
  );
  await expect(page.getByText("Lead criado.")).toBeVisible();
  expect((await serverState(page)).createRequests).toBe(1);
  expect((await serverState(page)).createHadIfMatch).toBe(false);
  expect(page.url()).not.toContain("Lead%20E2E");
  expect(
    await page.evaluate(() =>
      [localStorage, sessionStorage].some((storage) =>
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index);
          return key ? (storage.getItem(key) ?? "") : "";
        }).some((value) =>
          /Lead E2E|LEAD@EXAMPLE\.TEST|62999999999/iu.test(value),
        ),
      ),
    ),
  ).toBe(false);
  expect(
    consoleMessages.some((value) =>
      /Lead E2E|LEAD@EXAMPLE\.TEST|62999999999/iu.test(value),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() =>
      (
        globalThis as unknown as { __leadTestBroadcastMessages: string[] }
      ).__leadTestBroadcastMessages.some((value) =>
        /Lead E2E|LEAD@EXAMPLE\.TEST|62999999999/iu.test(value),
      ),
    ),
  ).toBe(false);
});

test("admin registra outra origem, UTM e responsável em Lead existente", async ({
  page,
}) => {
  await page.request.post("/__test/create-existing");
  await login(page, "admin@example.test", "/app/leads/new");
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead Admin");
  await page
    .getByRole("textbox", { name: /^Telefone/iu })
    .fill("+1 202-555-0123");
  await page.getByLabel("Origem", { exact: true }).selectOption("other");
  await page
    .getByRole("textbox", { name: /^Detalhe da origem/iu })
    .fill("Feira regional");
  await page.getByLabel("Responsável").selectOption({
    label: "Pessoa Responsável · responsavel@example.test",
  });
  await page.getByText("Rastreamento avançado", { exact: true }).click();
  await page.getByLabel("UTM campaign").fill("inverno-2026");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(
    page.getByText("Nova entrada registrada no Lead existente."),
  ).toBeVisible();
  await expect(page.getByText(/duplicidade/iu)).toHaveCount(0);
});

test("member cria com resultado 204 opaco sem consultar responsável", async ({
  page,
}) => {
  await login(page, "member@example.test", "/app/leads/new");
  await expect(page.getByLabel("Responsável")).toHaveCount(0);
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead Member");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(page).toHaveURL(/\/app\/leads$/u);
  await expect(page.getByText("Solicitação processada.")).toBeVisible();
  await expect(
    page.getByText(/Lead criado|Lead atualizado|duplicado/iu),
  ).toHaveCount(0);
});

test("validação foca o primeiro erro, limpa sourceDetail e protege draft", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/leads/new");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(page.getByRole("textbox", { name: /^Nome/iu })).toBeFocused();
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead Draft");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByLabel("Origem", { exact: true }).selectOption("other");
  await page
    .getByRole("textbox", { name: /^Detalhe da origem/iu })
    .fill("Evento");
  await page.getByLabel("Origem", { exact: true }).selectOption("manual");
  await expect(
    page.getByRole("textbox", { name: /^Detalhe da origem/iu }),
  ).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/app\/leads\/new$/u);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/app\/leads$/u);
});

test("timeout preserva intenção e confirmação reutiliza a mesma chave", async ({
  page,
}) => {
  await page.request.post("/__test/create-uncertain");
  await login(page, "owner@example.test", "/app/leads/new");
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead Incerto");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(
    page.getByRole("heading", { name: "Resultado não confirmado" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Resultado não confirmado" })
      .locator(".."),
  ).toHaveAttribute("aria-live", "assertive");
  await expect(page.getByRole("textbox", { name: /^Nome/iu })).toBeDisabled();
  await page.getByRole("button", { name: "Tentar confirmar" }).click();
  await expect(page.getByText("Resultado confirmado.")).toBeVisible();
  const state = await serverState(page);
  expect(state.createRequests).toBe(2);
  expect(state.createKeyReused).toBe(true);
});

test("troca de Organization confirma descarte e não transporta o draft", async ({
  page,
}) => {
  await login(page, "multi@example.test");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.goto("/app/leads/new");
  const name = page.getByRole("textbox", { name: /^Nome/iu });
  await name.fill("Draft do tenant anterior");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(name).toHaveValue("Draft do tenant anterior");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(
    page.getByRole("button", { name: "Selecionar organização" }),
  ).toContainText("Segunda Organização");
  await expect(page.getByRole("textbox", { name: /^Nome/iu })).toHaveValue("");
  await expect(page.getByLabel("Responsável")).toHaveCount(0);
});

test("logout descarta o draft sem bloquear a saída", async ({ page }) => {
  await login(page, "owner@example.test", "/app/leads/new");
  await page
    .getByRole("textbox", { name: /^Nome/iu })
    .fill("Draft descartado no logout");
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  expect(dialogs).toBe(0);
});

test("reload avisa sobre draft e reinicia o formulário somente em memória", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/leads/new");
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Draft de reload");
  let beforeUnloadSeen = false;
  page.once("dialog", async (dialog) => {
    beforeUnloadSeen = dialog.type() === "beforeunload";
    await dialog.accept();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Novo Lead" })).toBeVisible();
  expect(beforeUnloadSeen).toBe(true);
  await expect(page.getByRole("textbox", { name: /^Nome/iu })).toHaveValue("");
});

test("troca é recusada durante request e a resposta permanece no tenant original", async ({
  page,
}) => {
  await page.request.post("/__test/create-delay");
  await login(page, "multi@example.test");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.goto("/app/leads/new");
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead concorrente");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(
    page.getByText(/Aguarde a operação atual terminar/iu),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/app\/leads\/00000000-0000-4000-8000-000000000010$/u,
  );
  await expect(
    page.getByRole("button", { name: "Selecionar organização" }),
  ).toContainText("Genesis Teste");
});

test("logout durante request ignora a resposta tardia", async ({ page }) => {
  await page.request.post("/__test/create-delay");
  await login(page, "owner@example.test", "/app/leads/new");
  await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead tardio");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(page).toHaveURL(/\/login/u);
  await expect(page.getByText("Lead criado.")).toHaveCount(0);
});

test("conflito não repete automaticamente e preserva o formulário", async ({
  page,
}) => {
  await page.request.post("/__test/create-conflict");
  await login(page, "owner@example.test", "/app/leads/new");
  const name = page.getByRole("textbox", { name: /^Nome/iu });
  await name.fill("Lead Conflito");
  await page.getByRole("textbox", { name: /^Telefone/iu }).fill("11999999999");
  await page.getByRole("button", { name: "Criar Lead" }).click();
  await expect(
    page.getByText(/intenção de criação entrou em conflito/iu),
  ).toBeVisible();
  await expect(name).toHaveValue("Lead Conflito");
  await page.waitForTimeout(300);
  expect((await serverState(page)).createRequests).toBe(1);
});

test("criação mobile mantém inputs e ações acessíveis", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, "owner@example.test", "/app/leads/new");
  await expect(page.getByRole("heading", { name: "Novo Lead" })).toBeVisible();
  await expectTouchTarget(page.getByRole("textbox", { name: /^Nome/iu }));
  await expectTouchTarget(page.getByRole("textbox", { name: /^Telefone/iu }));
  await expectTouchTarget(page.getByRole("button", { name: "Cancelar" }));
  await expectTouchTarget(page.getByRole("button", { name: "Criar Lead" }));
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            matchMedia: (query: string) => { matches: boolean };
          }
        ).matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  const name = page.getByRole("textbox", { name: /^Nome/iu });
  const phone = page.getByRole("textbox", { name: /^Telefone/iu });
  await name.focus();
  await page.keyboard.press("Tab");
  await expect(phone).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "E-mail" })).toBeFocused();
  await expect(name).toHaveAttribute("required", "");
  await expect(phone).toHaveAttribute("aria-required", "true");
  await expect(page.getByRole("textbox", { name: "E-mail" })).toHaveAttribute(
    "inputmode",
    "email",
  );
});

test("Novo Lead permanece restrito à Inbox", async ({ page }) => {
  await login(page, "owner@example.test", "/app/pipeline");
  await expect(page.getByRole("link", { name: "Novo Lead" })).toHaveCount(0);
  await page.getByRole("link", { name: "Leads", exact: true }).click();
  await expect(page.getByRole("link", { name: "Novo Lead" })).toBeVisible();
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

test("Follow-up preserva contexto, usa preflight e conclui server-confirmed", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/follow-up");
  await expect(page).toHaveURL(/\/app\/follow-up$/u);
  await expect(
    page.getByRole("heading", { name: "Follow-up", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Minhas ações" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Atrasadas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Lead de Follow-up")).toBeVisible();
  await expect(page.getByText("+5511999999999")).toHaveCount(0);
  await expect(page.getByText("lead@example.test")).toHaveCount(0);

  await page.getByRole("link", { name: "Abrir detalhe" }).click();
  await expect(page).toHaveURL(
    /\/app\/leads\/00000000-0000-4000-8000-000000000040$/u,
  );
  await page.getByRole("link", { name: "Voltar para o Follow-up" }).click();
  await expect(page.getByRole("tab", { name: "Atrasadas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page
    .getByRole("button", { name: "Ações rápidas de Lead de Follow-up" })
    .click();
  await page.getByRole("menuitem", { name: "Concluir próxima ação" }).click();
  const dialog = page.getByRole("dialog", { name: "Concluir próxima ação" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Resultado opcional").fill("Contato concluído");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(
    page.getByText("Próxima ação atualizada e fila reorganizada."),
  ).toBeVisible();
  await expect(page.getByText("Lead de Follow-up")).toHaveCount(0);
  await expect(page.getByText("Nenhuma ação atrasada")).toBeVisible();
});

test("Follow-up mobile mantém tabs, Sheet e touch targets acessíveis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "owner@example.test", "/app/follow-up");
  const tabs = page.getByRole("tablist", { name: "Filas operacionais" });
  await expect(tabs).toBeVisible();
  await expectTouchTarget(page.getByRole("tab", { name: "Minhas ações" }));
  const filters = page.getByRole("button", { name: "Filtros" });
  await expectTouchTarget(filters);
  await filters.click();
  await expect(
    page.getByRole("dialog", { name: "Filtros da fila" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar menu" }).click();
  await expectTouchTarget(
    page.getByRole("button", { name: "Ações rápidas de Lead de Follow-up" }),
  );
});

test("Metrics owner usa período, URL, histórico, reload e refresh acessível", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/metrics");
  await expect(page).toHaveURL(/\/app\/metrics$/u);
  await expect(
    page.getByRole("heading", { name: "Métricas", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visão atual" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Desempenho do período" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Leads ativos" }).getByText("42"),
  ).toBeVisible();
  await expect(page.getByText("Fuso da operação: America/Belem")).toBeVisible();
  await expect(page.getByText(/conversão/iu)).toHaveCount(0);
  await expect(
    page.getByRole("listitem", { name: /Campanha: 12 Leads, 40%/iu }),
  ).toBeVisible();

  const period = page.getByLabel("Seleção de período");
  await period.selectOption("last7");
  await expect(page).toHaveURL(/from=2026-07-23&to=2026-07-29/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/metrics$/u);
  await page.goForward();
  await expect(page).toHaveURL(/from=2026-07-23&to=2026-07-29/u);

  await period.selectOption("last90");
  await expect(page).toHaveURL(/from=2026-05-01&to=2026-07-29/u);
  await period.selectOption("currentMonth");
  await expect(page).toHaveURL(/from=2026-07-01&to=2026-07-29/u);
  await period.selectOption("last30");
  await expect(page).toHaveURL(/\/app\/metrics$/u);

  await period.selectOption("custom");
  await page.getByLabel("De", { exact: true }).fill("2026-08-10");
  await page.getByLabel("Até", { exact: true }).fill("2026-08-10");
  await page.getByRole("button", { name: "Aplicar período" }).click();
  await expect(page).toHaveURL(/from=2026-08-10&to=2026-08-10/u);
  await page.reload();
  await expect(page.getByLabel("De", { exact: true })).toHaveValue(
    "2026-08-10",
  );

  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(page.getByRole("status")).toContainText(
    /Métricas atualizadas/iu,
  );
});

test("Metrics canonicaliza URL inválida, avisa e foca erro personalizado", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/metrics?foo=bar");
  await expect(
    page.getByText(/Parâmetros de período desconhecidos foram ignorados/iu),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/metrics$/u);
  const period = page.getByLabel("Seleção de período");
  await period.selectOption("custom");
  await page.getByLabel("De", { exact: true }).fill("2026-08-11");
  await page.getByLabel("Até", { exact: true }).fill("2026-08-10");
  await page.getByRole("button", { name: "Aplicar período" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page).toHaveURL(/\/app\/metrics$/u);
});

test("Metrics aceita admin e bloqueia member antes da consulta", async ({
  page,
}) => {
  await login(page, "admin@example.test", "/app/metrics");
  await expect(page.getByRole("group", { name: "Leads ativos" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByText("42")).toHaveCount(0);

  await login(page, "member@example.test", "/app/metrics");
  await expect(page.getByText(/Somente owner ou admin/iu)).toBeVisible();
  await expect(page.getByRole("link", { name: "Métricas" })).toHaveCount(0);
  expect((await serverState(page)).metricsRequests).toBe(1);
});

test("Metrics diferencia zeros válidos e source futura", async ({ page }) => {
  await page.request.post("/__test/metrics-zeros");
  await login(page, "owner@example.test", "/app/metrics");
  await expect(
    page.getByRole("group", { name: "Leads ativos" }).getByText("0"),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum Lead foi criado no período selecionado."),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: /Taxa de ganho/iu }).getByText("—"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await resetServer(page);
  await page.request.post("/__test/metrics-future-source");
  await login(page, "owner@example.test", "/app/metrics");
  await expect(page.getByText("Origem não catalogada")).toBeVisible();
  await expect(page.getByText("(partner_referral)")).toBeVisible();
});

for (const [status, message] of [
  [400, /Período não aceito/iu],
  [429, /cooldown/iu],
  [500, /Não foi possível carregar as métricas/iu],
  [503, /não está pronta para uma leitura confiável/iu],
] as const) {
  test(`Metrics trata ${status} sem mostrar zeros`, async ({ page }) => {
    await page.request.post(`/__test/metrics-status-${status}`);
    await login(page, "owner@example.test", "/app/metrics");
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole("group", { name: "Leads ativos" })).toHaveCount(
      0,
    );
  });
}

test("Metrics trata 403 após dados carregados de forma fail-closed", async ({
  page,
}) => {
  await login(page, "owner@example.test", "/app/metrics");
  await expect(page.getByText("42")).toBeVisible();
  await page.request.post("/__test/metrics-status-403");
  await page.getByRole("button", { name: "Atualizar" }).click();
  await expect(page.getByText(/Somente owner ou admin/iu)).toBeVisible();
  await expect(page.getByText("42")).toHaveCount(0);
});

test("Metrics 401 encerra a sessão sem manter dados", async ({ page }) => {
  await page.request.post("/__test/metrics-status-401");
  await login(page, "owner@example.test", "/app/metrics");
  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await expect(page.getByText("42")).toHaveCount(0);
});

test("Metrics troca para Organization member sem manter dados do tenant anterior", async ({
  page,
}) => {
  await login(page, "multi@example.test", "/app/metrics");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.getByRole("link", { name: "Métricas" }).click();
  await expect(
    page.getByRole("group", { name: "Leads ativos" }).getByText("42"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(page.getByText(/Somente owner ou admin/iu)).toBeVisible();
  await expect(page.getByText("42")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Métricas" })).toHaveCount(0);
});

test("Metrics ignora resposta tardia do tenant anterior", async ({ page }) => {
  await page.request.post("/__test/metrics-delay");
  await login(page, "multi@example.test", "/app/metrics");
  await page
    .getByRole("button", { name: /Genesis Teste.*Papel: owner/iu })
    .click();
  await page.getByRole("link", { name: "Métricas" }).click();
  await expect
    .poll(async () => (await serverState(page)).metricsRequests)
    .toBe(1);
  await page.getByRole("button", { name: "Selecionar organização" }).click();
  await page.getByRole("menuitem", { name: "Segunda Organização" }).click();
  await expect(page.getByText(/Somente owner ou admin/iu)).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByText("42")).toHaveCount(0);
});

test("Metrics mobile preserva touch, teclado e visualização textual", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "owner@example.test", "/app/metrics");
  const refresh = page.getByRole("button", { name: "Atualizar" });
  const period = page.getByLabel("Seleção de período");
  await expectTouchTarget(refresh);
  await expectTouchTarget(period);
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const mobileMenu = page.getByRole("dialog", { name: "Menu principal" });
  await expectTouchTarget(mobileMenu.getByRole("link", { name: "Métricas" }));
  await page.getByRole("button", { name: "Fechar menu" }).click();
  await expect(mobileMenu).toBeHidden();
  await period.focus();
  await page.keyboard.press("End");
  await expect(page.getByLabel("De", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: /Campanha: 12 Leads, 40%/iu }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toHaveCSS("overflow-x", "scroll");
});

function leadIdForTest(): string {
  return "00000000-0000-4000-8000-000000000010";
}
