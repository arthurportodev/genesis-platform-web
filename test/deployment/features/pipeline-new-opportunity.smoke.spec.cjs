const { expect, test } = require("@playwright/test");

const {
  assertCoreDiagnostics,
  createDiagnostics,
  deriveSyntheticLeadIdentity,
  logout,
  reachProtectedRoute,
  readHarnessContract,
  requireFeatureSmokeExecution,
  safeReasonCode,
  sanitizedDiagnostics,
} = require("../../../scripts/deployment/web-smoke-harness.cjs");

const FEATURE_ID = "PIPE-V2-04";
const contract = Object.freeze({
  ...readHarnessContract(process.env, {
    profileId: "production-feature",
    featureId: FEATURE_ID,
    requiredMutations: ["lead.create"],
  }),
  targetRoute: "/app/pipeline",
});

function leadCardById(container, leadId) {
  return container.getByRole("article").filter({
    has: container.locator(`a[href="/app/leads/${leadId}"]`),
  });
}

async function assertNoExistingReleaseLead(page, identity) {
  const response = page.waitForResponse(
    (candidate) => {
      try {
        const url = new URL(candidate.url());
        return (
          url.pathname === "/api/v1/leads/kanban" &&
          url.searchParams.get("q") === identity.displayName &&
          candidate.status() === 200
        );
      } catch {
        return false;
      }
    },
    { timeout: 30_000 },
  );
  const search = page.getByLabel("Buscar", { exact: true }).filter({
    visible: true,
  });
  await expect(search).toHaveCount(1);
  await search.fill(identity.displayName);
  let payload;
  try {
    payload = await (await response).json();
  } catch {
    throw new Error("RELEASE_IDENTITY_QUERY_INVALID");
  }
  const exactMatches = Array.isArray(payload?.columns)
    ? payload.columns
        .flatMap((column) => column.items ?? [])
        .filter((lead) => lead?.name === identity.displayName)
    : null;
  if (exactMatches === null) {
    throw new Error("RELEASE_IDENTITY_QUERY_INVALID");
  }
  if (exactMatches.length > 0) {
    throw new Error("RELEASE_IDENTITY_ALREADY_EXISTS");
  }
  await search.fill("");
  await expect(
    page.getByRole("link", { name: "Nova oportunidade", exact: true }),
  ).toBeVisible();
}

test("Pipeline New Opportunity validates its controlled critical path", async ({
  page,
}) => {
  const diagnostics = createDiagnostics(page, contract);
  let executed = false;
  let productionMutation = false;
  try {
    diagnostics.stage = "reach-pipeline";
    const flow = await reachProtectedRoute(page, contract, diagnostics);
    if (!flow.authorization.businessMutationsAuthorized) {
      throw new Error("SMOKE_MUTATION_NOT_AUTHORIZED");
    }
    const identity = deriveSyntheticLeadIdentity({
      dataPrefix: flow.authorization.dataPrefix,
      featureId: FEATURE_ID,
      functionalSha: process.env.GENESIS_WEB_FUNCTIONAL_SHA,
    });

    diagnostics.stage = "release-identity-precondition";
    await assertNoExistingReleaseLead(page, identity);

    diagnostics.stage = "open-existing-create-page";
    await page
      .getByRole("link", { name: "Nova oportunidade", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/leads\/new\?from=pipeline$/u);
    await expect(
      page.getByRole("heading", { name: "Nova oportunidade", exact: true }),
    ).toBeVisible();

    diagnostics.stage = "create-new-opportunity";
    await page
      .getByRole("textbox", { name: /^Nome/iu })
      .fill(identity.displayName);
    await page
      .getByRole("textbox", { name: /^Telefone/iu })
      .fill(identity.phone);
    const expectedValue = page.getByRole("textbox", {
      name: "Valor da oportunidade",
    });
    await expectedValue.fill("1234,5");
    await expectedValue.blur();
    await expect(expectedValue).toHaveValue("1.234,50");
    const createResponsePromise = page.waitForResponse(
      (candidate) => {
        try {
          return (
            new URL(candidate.url()).pathname === "/api/v1/leads" &&
            candidate.request().method() === "POST"
          );
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    );
    productionMutation = true;
    await page.getByRole("button", { name: "Criar Lead" }).click();
    const createResponse = await createResponsePromise;
    if (createResponse.status() !== 201) {
      throw new Error("NEW_OPPORTUNITY_CREATE_NOT_IDENTIFIED");
    }
    let created;
    try {
      created = await createResponse.json();
    } catch {
      throw new Error("CREATED_LEAD_RESPONSE_INVALID");
    }
    const leadId = created?.id;
    if (!/^[0-9a-f-]{36}$/iu.test(leadId ?? "")) {
      throw new Error("CREATED_LEAD_ID_NOT_OBSERVED");
    }

    diagnostics.stage = "created-card-in-new-column";
    await expect(page).toHaveURL(/\/app\/pipeline$/u);
    await expect(page.getByText("Oportunidade criada.")).toBeVisible();
    const newColumn = page.locator(
      '[aria-labelledby="pipeline-column-desktop-new"]',
    );
    const createdLeadCard = leadCardById(newColumn, leadId);
    await expect(createdLeadCard).toHaveCount(1);
    await expect(createdLeadCard).toContainText(identity.displayName);
    await expect(createdLeadCard).toContainText("R$ 1.234,50");

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
        feature: "Pipeline New Opportunity",
        profileId: contract.profileId,
        route: contract.targetRoute,
        executed,
        diagnostics: sanitizedDiagnostics(diagnostics),
        credentialsPrinted: false,
        screenshotsCaptured: false,
        productionMutation,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        result: "FAIL",
        feature: "Pipeline New Opportunity",
        profileId: contract.profileId,
        executed,
        reasonCode: safeReasonCode(error),
        diagnostics: sanitizedDiagnostics(diagnostics),
        credentialsPrinted: false,
        screenshotsCaptured: false,
        productionMutation,
      }),
    );
    throw new Error(safeReasonCode(error));
  }
});
