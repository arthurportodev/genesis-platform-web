import { expect, test, type Page } from "@playwright/test";

function observeRuntime(page: Page) {
  const consoleErrors: string[] = [];
  const unexpectedHttp: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) {
      unexpectedHttp.push(request.url());
    }
  });

  return () => {
    expect(consoleErrors, "erros relevantes no console").toEqual([]);
    expect(unexpectedHttp, "requests HTTP inesperadas da aplicação").toEqual(
      [],
    );
  };
}

test("carrega /login diretamente sem API ou erro de console", async ({
  page,
}) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Acesse sua conta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/u);
  expectCleanRuntime();
});

test("carrega /app diretamente e mantém estados honestos", async ({ page }) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.goto("/app");

  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(page.getByText("Dados indisponíveis")).toBeVisible();
  await expect(page.getByText("Agenda não conectada")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Genesis Platform, início" }),
  ).toBeVisible();
  expectCleanRuntime();
});

test("navega pelo menu desktop entre páginas administrativas", async ({
  page,
}) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.goto("/app");

  await page.getByRole("link", { name: "Pipeline" }).click();
  await expect(
    page.getByRole("heading", { name: "Pipeline", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Follow-up" }).click();
  await expect(
    page.getByRole("heading", { name: "Follow-up", exact: true }),
  ).toBeVisible();
  expectCleanRuntime();
});

test("rota profunda preserva fallback SPA em acesso direto e reload", async ({
  page,
}) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.goto("/app/leads/lead-42");

  await expect(
    page.getByRole("heading", { name: "Detalhes do lead" }),
  ).toBeVisible();
  await expect(page.getByText(/referência de rota: lead-42/i)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Detalhes do lead" }),
  ).toBeVisible();
  expectCleanRuntime();
});

test("rota desconhecida exibe o not found", async ({ page }) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.goto("/rota-inexistente");

  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  expectCleanRuntime();
});

test("menu mobile e seletor de empresa permanecem acessíveis", async ({
  page,
}) => {
  const expectCleanRuntime = observeRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");

  await expect(
    page.getByRole("link", { name: "Genesis Platform, início" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Menu principal" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

  const organizationTrigger = page.getByRole("button", {
    name: "Selecionar empresa",
  });
  await expect(organizationTrigger).toHaveAttribute("aria-expanded", "false");
  await organizationTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('[aria-label="Selecionar empresa"]'),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByText("Integração pendente")).toBeVisible();
  expectCleanRuntime();
});
