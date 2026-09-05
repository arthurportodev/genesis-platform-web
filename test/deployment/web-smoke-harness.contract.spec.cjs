const { expect, test } = require("@playwright/test");

const {
  loginContractVisible,
  organizationContractVisible,
} = require("../../scripts/deployment/web-smoke-harness.cjs");

for (const headingTag of ["h1", "h2"]) {
  test(`login detection is independent of ${headingTag} level`, async ({
    page,
  }) => {
    await page.setContent(`
      <main>
        <${headingTag}>Acesse sua conta</${headingTag}>
        <label for="email">E-mail</label><input id="email" />
        <label for="password">Senha</label><input id="password" type="password" />
        <button>Entrar</button>
      </main>
    `);
    await expect(
      page.getByRole("heading", { name: "Acesse sua conta", exact: true }),
    ).toBeVisible();
    expect(await loginContractVisible(page)).toBe(true);
  });
}

test("organization detection uses the labelled container and real UI options", async ({
  page,
}) => {
  await page.setContent(`
    <main>
      <h2>Selecione uma organização</h2>
      <button>Decoy outside container</button>
      <div aria-label="Organizações disponíveis">
        <button>Genesis Teste — Papel: owner</button>
      </div>
    </main>
  `);
  expect(await organizationContractVisible(page)).toBe(true);
  const options = page
    .locator('[aria-label="Organizações disponíveis"]')
    .getByRole("button");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveText(/Genesis Teste/u);
});
