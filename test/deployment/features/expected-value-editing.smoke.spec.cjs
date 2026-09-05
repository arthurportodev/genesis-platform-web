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

const FEATURE_ID = "PIPE-V2-03A";
const WEB_FUNCTIONAL_INTEGRATED_SHA =
  "90dc36a3e8a53c1e1852b6acfb8b4c05c97e44e6";
const contract = Object.freeze({
  ...readHarnessContract(process.env, {
    profileId: "production-feature",
    featureId: FEATURE_ID,
    requiredMutations: ["lead.create", "lead.update"],
  }),
  targetRoute: "/app/leads/new",
});

function leadCardById(page, leadId) {
  return page.getByRole("article").filter({
    has: page.locator(`a[href="/app/leads/${leadId}"]`),
  });
}

async function assertNoExistingReleaseLead(page, identity) {
  await page.getByRole("link", { name: "Pipeline", exact: true }).click();
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
  await expect(
    page.getByRole("button", { name: "Atualizar", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: identity.displayName, exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/leads/new", {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
}

test("Expected Value Editing validates its controlled critical path", async ({
  page,
}) => {
  const diagnostics = createDiagnostics(page, contract);
  let executed = false;
  let productionMutation = false;
  try {
    diagnostics.stage = "reach-create-route";
    const flow = await reachProtectedRoute(page, contract, diagnostics);
    if (!flow.authorization.businessMutationsAuthorized) {
      throw new Error("SMOKE_MUTATION_NOT_AUTHORIZED");
    }
    const identity = deriveSyntheticLeadIdentity({
      dataPrefix: flow.authorization.dataPrefix,
      featureId: FEATURE_ID,
      functionalSha: WEB_FUNCTIONAL_INTEGRATED_SHA,
    });

    if (!contract.usesLocalFixtures) {
      diagnostics.stage = "release-identity-precondition";
      await assertNoExistingReleaseLead(page, identity);
      productionMutation = true;
    }

    diagnostics.stage = "create-with-expected-value";
    await page
      .getByRole("textbox", { name: /^Nome/iu })
      .fill(identity.displayName);
    await page
      .getByRole("textbox", { name: /^Telefone/iu })
      .fill(identity.phone);
    const createValue = page.getByRole("textbox", {
      name: "Valor da oportunidade",
    });
    await expect(createValue).toHaveAttribute("placeholder", "0,00");
    await createValue.fill("1234,5");
    await createValue.blur();
    await expect(createValue).toHaveValue("1.234,50");
    await page.getByRole("button", { name: "Criar Lead" }).click();
    await expect(page.getByText("Lead criado.")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/leads\/[0-9a-f-]{36}$/iu);
    const leadId = new URL(page.url()).pathname.split("/").at(-1);
    if (!/^[0-9a-f-]{36}$/iu.test(leadId ?? "")) {
      throw new Error("CREATED_LEAD_ID_NOT_OBSERVED");
    }
    const editValue = page.getByLabel("Valor da oportunidade", {
      exact: true,
    });
    await expect(editValue).toHaveValue("1.234,50");

    diagnostics.stage = "created-value-in-pipeline";
    await page.getByRole("link", { name: "Pipeline", exact: true }).click();
    const createdLeadCard = leadCardById(page, leadId);
    await expect(createdLeadCard).toHaveCount(1);
    await expect(createdLeadCard).toContainText("R$ 1.234,50");
    if (!contract.usesLocalFixtures) {
      await expect(createdLeadCard).toContainText(identity.displayName);
    }
    await createdLeadCard
      .getByRole("link", { name: "Abrir detalhe", exact: true })
      .click();

    diagnostics.stage = "atomic-combined-edit";
    await expect(page).toHaveURL(new RegExp(`/app/leads/${leadId}$`, "u"));
    const city = page.getByLabel("Cidade", { exact: true });
    await city.fill("Anápolis");
    await editValue.fill("2000");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Dados do Lead atualizados.")).toBeVisible();
    await expect(editValue).toHaveValue("2.000,00");
    await expect(
      page.getByText("Valor da oportunidade alterado"),
    ).toBeVisible();
    await expect(page.getByText("R$ 1.234,50 → R$ 2.000,00")).toBeVisible();

    diagnostics.stage = "edited-value-in-pipeline";
    await page.getByRole("link", { name: "Pipeline", exact: true }).click();
    const editedLeadCard = leadCardById(page, leadId);
    await expect(editedLeadCard).toHaveCount(1);
    await expect(editedLeadCard).toContainText("R$ 2.000,00");

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
        feature: "Expected Value Editing",
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
