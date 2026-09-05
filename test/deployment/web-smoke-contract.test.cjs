const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const {
  LOCAL_BASE_URL,
  PRODUCTION_BASE_URL,
  classifyGeneratedHostResponse,
  parseTargetRoute,
  readHarnessContract,
  requireFeatureSmokeExecution,
} = require("../../scripts/deployment/web-smoke-harness.cjs");

for (const target of ["local", "production"]) {
  for (const featureRequired of [false, true]) {
    test(`${target} preserves explicit feature required=${featureRequired}`, () => {
      const contract = readHarnessContract({
        GENESIS_HARNESS_TARGET: target,
        GENESIS_HARNESS_BASE_URL:
          target === "local" ? LOCAL_BASE_URL : PRODUCTION_BASE_URL,
        GENESIS_REQUIRE_FEATURE_SMOKE: String(featureRequired),
      });
      assert.equal(contract.target, target);
      assert.equal(contract.featureSmokeRequired, featureRequired);
    });
  }
}

test("production target plus required feature remains required on controlled candidate", () => {
  const contract = readHarnessContract({
    GENESIS_HARNESS_TARGET: "production",
    GENESIS_HARNESS_BASE_URL: LOCAL_BASE_URL,
    GENESIS_REQUIRE_FEATURE_SMOKE: "true",
    GENESIS_SMOKE_ROUTE: "/app/pipeline",
  });
  assert.equal(contract.target, "production");
  assert.equal(contract.baseUrlClass, "controlled-local");
  assert.equal(contract.featureSmokeRequired, true);
  assert.throws(
    () => requireFeatureSmokeExecution(contract, false),
    /MANDATORY_FEATURE_SMOKE_GATE_UNAVAILABLE/u,
  );
  assert.doesNotThrow(() => requireFeatureSmokeExecution(contract, true));
});

test("target route is a protected relative path", () => {
  assert.equal(parseTargetRoute("/app"), "/app");
  assert.equal(parseTargetRoute("/app/pipeline"), "/app/pipeline");
  for (const invalid of [
    "/",
    "/login",
    "/select-organization",
    "https://example.com/app",
    "/app?candidate=1",
    "/app/../login",
    "/app\\pipeline",
  ]) {
    assert.throws(
      () => parseTargetRoute(invalid),
      /GENESIS_SMOKE_ROUTE_INVALID/u,
    );
  }
});

test("generated host accepts an application 4xx without Genesis content", () => {
  assert.deepEqual(
    classifyGeneratedHostResponse({
      status: 404,
      body: '{"message":"not found"}',
      headers: new Headers(),
      generatedHost: "candidate.vercel.app",
    }),
    {
      status: 404,
      classification: "APPLICATION_FAIL_CLOSED",
      functionalGenesisApiReachable: false,
      credentialsSent: false,
      redirectFollowed: false,
    },
  );
});

test("generated host accepts only strictly proven Vercel protection redirects", () => {
  const result = classifyGeneratedHostResponse({
    status: 302,
    body: "",
    headers: new Headers({
      location:
        "https://vercel.com/sso-api?url=https%3A%2F%2Fcandidate.vercel.app%2Fapi%2Fv1%2Fauth%2Fcsrf",
      server: "Vercel",
      "cache-control": "private, no-store",
      "set-cookie": "_vercel_sso_nonce=opaque; Secure; HttpOnly",
    }),
    generatedHost: "candidate.vercel.app",
  });
  assert.equal(result.classification, "VERCEL_DEPLOYMENT_PROTECTION");

  assert.throws(
    () =>
      classifyGeneratedHostResponse({
        status: 302,
        body: "",
        headers: new Headers({ location: "https://example.com/login" }),
        generatedHost: "candidate.vercel.app",
      }),
    /VERCEL_PROTECTION_DESTINATION_INVALID/u,
  );
});

test("generated host never accepts Genesis content or a generic success", () => {
  assert.throws(
    () =>
      classifyGeneratedHostResponse({
        status: 404,
        body: "Genesis csrfToken",
        headers: new Headers(),
        generatedHost: "candidate.vercel.app",
      }),
    /GENERATED_HOST_EXPOSED_GENESIS/u,
  );
  assert.throws(
    () =>
      classifyGeneratedHostResponse({
        status: 200,
        body: "",
        headers: new Headers(),
        generatedHost: "candidate.vercel.app",
      }),
    /GENERATED_HOST_NOT_FAIL_CLOSED/u,
  );
});

test("core smoke remains feature-agnostic and task-packet independent", () => {
  const core = readFileSync("test/deployment/web-core-smoke.spec.cjs", "utf8");
  assert.doesNotMatch(
    core,
    /Presentation V2|Resumo do Pipeline|Valor esperado/u,
  );
  assert.doesNotMatch(core, /\.codex[\\/]task-packets/u);
});

test("core diagnostics are asserted only after logout completes", () => {
  for (const spec of [
    "test/deployment/web-core-smoke.spec.cjs",
    "test/deployment/features/presentation-v2.smoke.spec.cjs",
  ]) {
    const source = readFileSync(spec, "utf8");
    const logoutIndex = source.indexOf("await logout(page)");
    const diagnosticsIndex = source.indexOf(
      "assertCoreDiagnostics(diagnostics)",
    );
    assert.notEqual(logoutIndex, -1, `${spec} must perform logout`);
    assert.notEqual(
      diagnosticsIndex,
      -1,
      `${spec} must assert core diagnostics`,
    );
    assert.ok(
      logoutIndex < diagnosticsIndex,
      `${spec} must include logout activity in final diagnostics`,
    );
  }
});

test("API migration levels preserve the Production Gate before mutation", () => {
  const runbook = readFileSync("docs/DEPLOYMENT_RUNBOOK.md", "utf8");
  const level1 = runbook
    .split(/\r?\n/u)
    .find((line) => /^\| 1\s+\|/u.test(line));
  const level2 = runbook
    .split(/\r?\n/u)
    .find((line) => /^\| 2\s+\|/u.test(line));

  assert.match(
    level1 ?? "",
    /preflight → Gate Production → pointer/u,
    "Level 1 must place the Production Gate before the pointer mutation",
  );
  assert.match(
    level2 ?? "",
    /preflight → Gate Production → checkpoint → migration one-shot/u,
    "Level 2 must place the Production Gate before checkpoint and migration",
  );
});
