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
  targetRoute: "/app/pipeline",
});

test("Presentation V2 feature smoke remains an explicit release check", async ({
  page,
}) => {
  const diagnostics = createDiagnostics(page, contract);
  let executed = false;
  try {
    diagnostics.stage = "reach-feature-route";
    await reachProtectedRoute(page, contract, diagnostics);
    diagnostics.stage = "feature-assertions";
    const summary = page.getByRole("region", { name: "Resumo do Pipeline" });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Oportunidades");
    await expect(summary).toContainText("Valor esperado");
    await expect(summary).toContainText(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/u);
    await expect(
      page.locator("[data-pipeline-column-heading]:visible"),
    ).toHaveCount(5);
    await expect(page.getByTestId("pipeline-desktop-board")).toBeVisible();
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
        feature: "Presentation V2",
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
        feature: "Presentation V2",
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
