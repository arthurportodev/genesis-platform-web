const { test } = require("@playwright/test");

const {
  assertCoreDiagnostics,
  createDiagnostics,
  logout,
  reachProtectedRoute,
  readHarnessContract,
  safeReasonCode,
  sanitizedDiagnostics,
} = require("../../scripts/deployment/web-smoke-harness.cjs");

const contract = readHarnessContract();

test("core Web smoke traverses the real protected application flow", async ({
  page,
}) => {
  const diagnostics = createDiagnostics(page, contract);
  try {
    diagnostics.stage = "reach-protected-route";
    const flow = await reachProtectedRoute(page, contract, diagnostics);
    diagnostics.stage = "logout";
    await logout(page);
    diagnostics.stage = "core-assertions";
    assertCoreDiagnostics(diagnostics);
    diagnostics.stage = "complete";
    console.log(
      JSON.stringify({
        result: "PASS",
        contract: {
          target: contract.target,
          baseUrlClass: contract.baseUrlClass,
          targetRoute: contract.targetRoute,
          featureSmokeRequired: contract.featureSmokeRequired,
        },
        flow: {
          transitions: flow.transitions,
          finalPath: flow.finalPath,
          shellReached: true,
          logoutConfirmed: true,
        },
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
