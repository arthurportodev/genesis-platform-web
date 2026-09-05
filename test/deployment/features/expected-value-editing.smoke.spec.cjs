const { expect, test } = require("@playwright/test");

const {
  assertCoreDiagnostics,
  createDiagnostics,
  logout,
  reachProtectedRoute,
  readHarnessContract,
  requireFeatureSmokeExecution,
  safeReasonCode,
  sanitizedDiagnostics,
} = require("../../../scripts/deployment/web-smoke-harness.cjs");

const baseContract = readHarnessContract();
const contract = Object.freeze({
  ...baseContract,
  targetRoute: "/app/leads/new",
});

test("Expected Value Editing validates its controlled critical path", async ({
  page,
}) => {
  const diagnostics = createDiagnostics(page, contract);
  let executed = false;
  try {
    if (!contract.usesLocalFixtures)
      throw new Error("EXPECTED_VALUE_SMOKE_REQUIRES_CONTROLLED_LOCAL");

    diagnostics.stage = "reach-create-route";
    await reachProtectedRoute(page, contract, diagnostics);
    diagnostics.stage = "create-with-expected-value";
    await page.getByRole("textbox", { name: /^Nome/iu }).fill("Lead Smoke");
    await page
      .getByRole("textbox", { name: /^Telefone/iu })
      .fill("62999999999");
    const createValue = page.getByRole("textbox", {
      name: "Valor da oportunidade",
    });
    await expect(createValue).toHaveAttribute("placeholder", "0,00");
    await createValue.fill("1234,5");
    await createValue.blur();
    await expect(createValue).toHaveValue("1.234,50");
    await page.getByRole("button", { name: "Criar Lead" }).click();
    await expect(page.getByText("Lead criado.")).toBeVisible();
    const editValue = page.getByLabel("Valor da oportunidade", {
      exact: true,
    });
    await expect(editValue).toHaveValue("1.234,50");

    diagnostics.stage = "created-value-in-pipeline";
    await page.getByRole("link", { name: "Pipeline", exact: true }).click();
    await expect(page.getByTestId("pipeline-desktop-board")).toContainText(
      "R$ 1.234,50",
    );
    const createdLeadCard = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Lead Exemplo", exact: true }),
    });
    await createdLeadCard
      .getByRole("link", { name: "Abrir detalhe", exact: true })
      .click();

    diagnostics.stage = "atomic-combined-edit";
    await expect(page).toHaveURL(/\/app\/leads\/[0-9a-f-]{36}$/iu);
    const city = page.getByLabel("Cidade", { exact: true });
    await city.fill("Anápolis");
    await editValue.fill("2000");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dados do Lead atualizados.")).toBeVisible();
    await expect(
      page.getByText("Valor da oportunidade alterado"),
    ).toBeVisible();
    await expect(page.getByText("R$ 1.234,50 → R$ 2.000,00")).toBeVisible();

    diagnostics.stage = "edited-value-in-pipeline";
    await page.getByRole("link", { name: "Pipeline", exact: true }).click();
    await expect(page.getByTestId("pipeline-desktop-board")).toContainText(
      "R$ 2.000,00",
    );

    executed = true;
    requireFeatureSmokeExecution(contract, executed);
    diagnostics.stage = "logout";
    await logout(page);
    diagnostics.stage = "core-assertions";
    assertCoreDiagnostics(diagnostics);
    diagnostics.stage = "complete";
    console.log(
      JSON.stringify({
        result: "PASS",
        feature: "Expected Value Editing",
        route: contract.targetRoute,
        executed,
        diagnostics: sanitizedDiagnostics(diagnostics),
        credentialsPrinted: false,
        screenshotsCaptured: false,
        productionMutation: false,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        result: "FAIL",
        feature: "Expected Value Editing",
        executed,
        reasonCode: safeReasonCode(error),
        diagnostics: sanitizedDiagnostics(diagnostics),
        credentialsPrinted: false,
        screenshotsCaptured: false,
        productionMutation: false,
      }),
    );
    throw new Error(safeReasonCode(error));
  }
});
