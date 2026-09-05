const { expect, test } = require("@playwright/test");

const {
  loginContractVisible,
  organizationContractVisible,
  selectOrganizationByExactName,
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

test("organization selection uses one exact bound name inside the labelled container", async ({
  page,
}) => {
  await page.setContent(`
    <main>
      <h2>Selecione uma organização</h2>
      <button>Decoy outside container</button>
      <div aria-label="Organizações disponíveis">
        <button data-selected="false">
          <span>Genesis Teste</span><span>Papel: owner</span>
        </button>
        <button data-selected="false">
          <span>Segunda Organização</span><span>Papel: member</span>
        </button>
      </div>
      <script>
        document.querySelectorAll('[data-selected]').forEach((button) => {
          button.addEventListener('click', () => button.dataset.selected = 'true');
        });
      </script>
    </main>
  `);
  expect(await organizationContractVisible(page)).toBe(true);
  const options = page
    .locator('[aria-label="Organizações disponíveis"]')
    .getByRole("button");
  await expect(options).toHaveCount(2);
  await selectOrganizationByExactName(page, "Genesis Teste");
  await expect(options.nth(0)).toHaveAttribute("data-selected", "true");
  await expect(options.nth(1)).toHaveAttribute("data-selected", "false");
});

test("organization selection fails closed for an ambiguous exact name", async ({
  page,
}) => {
  await page.setContent(`
    <h2>Selecione uma organização</h2>
    <div aria-label="Organizações disponíveis">
      <button><span>Genesis Teste</span><span>Papel: owner</span></button>
      <button><span>Genesis Teste</span><span>Papel: owner</span></button>
    </div>
  `);
  await expect(
    selectOrganizationByExactName(page, "Genesis Teste"),
  ).rejects.toThrow(/BOUND_ORGANIZATION_NAME_NOT_UNIQUE/u);
});
