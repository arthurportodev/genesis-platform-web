const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const {
  LOCAL_BASE_URL,
  PRODUCTION_BASE_URL,
  SMOKE_PROFILES,
  authorizeSmokeProfile,
  classifyGeneratedHostResponse,
  deriveSyntheticLeadIdentity,
  loadSmokeProfileBinding,
  parseTargetRoute,
  parseSmokeProfileBinding,
  readHarnessContract,
  requireFeatureSmokeExecution,
  validateBootstrapBinding,
} = require("../../scripts/deployment/web-smoke-harness.cjs");

const bindingValue = Object.freeze({
  schemaVersion: "genesis-smoke-profile.v1",
  profileId: "production-feature",
  principalUserId: "10000000-0000-4000-8000-000000000001",
  principalEmail: "genesis-smoke@example.test",
  organizationId: "10000000-0000-4000-8000-000000000002",
  organizationName: "Genesis Smoke Production",
  requiredRole: "owner",
  allowedFeatures: ["PIPE-V2-03A"],
  allowedMutations: ["lead.create", "lead.update"],
  dataPrefix: "[GENESIS-SMOKE]",
});

function featureContract(overrides = {}) {
  return readHarnessContract(
    {
      GENESIS_HARNESS_TARGET: "production",
      GENESIS_HARNESS_BASE_URL: LOCAL_BASE_URL,
    },
    {
      profileId: "production-feature",
      featureId: "PIPE-V2-03A",
      requiredMutations: ["lead.create", "lead.update"],
      ...overrides,
    },
  );
}

function bootstrapValue(overrides = {}) {
  return {
    user: {
      id: bindingValue.principalUserId,
      name: "Genesis Smoke",
      email: bindingValue.principalEmail,
      status: "active",
      ...overrides.user,
    },
    organizations: overrides.organizations ?? [
      {
        id: bindingValue.organizationId,
        name: bindingValue.organizationName,
        slug: "genesis-smoke-production",
        membershipId: "10000000-0000-4000-8000-000000000003",
        role: bindingValue.requiredRole,
      },
    ],
  };
}

test("the smoke profile vocabulary is exact", () => {
  assert.deepEqual(SMOKE_PROFILES, [
    "generated-host",
    "production-core",
    "production-feature",
  ]);
  assert.throws(
    () => readHarnessContract({}, { profileId: "staging" }),
    /GENESIS_SMOKE_PROFILE_INVALID/u,
  );
});

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
  const contract = readHarnessContract(
    {
      GENESIS_HARNESS_TARGET: "production",
      GENESIS_HARNESS_BASE_URL: LOCAL_BASE_URL,
      GENESIS_REQUIRE_FEATURE_SMOKE: "true",
      GENESIS_SMOKE_ROUTE: "/app/pipeline",
    },
    {
      profileId: "production-feature",
      featureId: "PIPE-V2-03A",
      requiredMutations: ["lead.create", "lead.update"],
    },
  );
  assert.equal(contract.target, "production");
  assert.equal(contract.baseUrlClass, "controlled-local");
  assert.equal(contract.featureSmokeRequired, true);
  assert.throws(
    () => requireFeatureSmokeExecution(contract, false),
    /MANDATORY_FEATURE_SMOKE_GATE_UNAVAILABLE/u,
  );
  assert.doesNotThrow(() => requireFeatureSmokeExecution(contract, true));
});

test("production-feature accepts the real Production target without local fixtures", () => {
  const contract = readHarnessContract(
    {
      GENESIS_HARNESS_TARGET: "production",
      GENESIS_HARNESS_BASE_URL: PRODUCTION_BASE_URL,
    },
    {
      profileId: "production-feature",
      featureId: "PIPE-V2-03A",
      requiredMutations: ["lead.create", "lead.update"],
    },
  );
  assert.equal(contract.target, "production");
  assert.equal(contract.usesLocalFixtures, false);
  assert.throws(
    () =>
      readHarnessContract(
        { GENESIS_HARNESS_TARGET: "local" },
        {
          profileId: "production-feature",
          featureId: "PIPE-V2-03A",
          requiredMutations: ["lead.create", "lead.update"],
        },
      ),
    /FEATURE_PROFILE_REQUIRES_PRODUCTION_TARGET/u,
  );
});

test("binding schema is strict, non-secret, and loadable without Production", () => {
  const parsed = parseSmokeProfileBinding({ ...bindingValue });
  assert.deepEqual(parsed, bindingValue);
  assert.deepEqual(
    loadSmokeProfileBinding(featureContract(), {
      GENESIS_SMOKE_PROFILE_JSON: JSON.stringify(bindingValue),
    }),
    bindingValue,
  );
  assert.throws(
    () =>
      loadSmokeProfileBinding(featureContract(), {
        GENESIS_SMOKE_PROFILE_JSON: "",
      }),
    /SMOKE_PROFILE_UNAVAILABLE/u,
  );
  for (const invalid of [
    { ...bindingValue, password: "forbidden" },
    { ...bindingValue, schemaVersion: "v2" },
    { ...bindingValue, principalUserId: "not-a-uuid" },
    { ...bindingValue, requiredRole: "admin" },
    { ...bindingValue, dataPrefix: "Smoke" },
    { ...bindingValue, allowedFeatures: [] },
  ]) {
    assert.throws(() => parseSmokeProfileBinding(invalid));
  }
  const incomplete = { ...bindingValue };
  delete incomplete.organizationId;
  assert.throws(
    () => parseSmokeProfileBinding(incomplete),
    /SMOKE_PROFILE_BINDING_KEYS_INVALID/u,
  );
});

test("feature and mutation authorization fail closed", () => {
  const binding = parseSmokeProfileBinding({ ...bindingValue });
  const approved = authorizeSmokeProfile(featureContract(), binding);
  assert.equal(approved.businessMutationsAuthorized, true);
  assert.throws(
    () =>
      authorizeSmokeProfile(featureContract({ featureId: "OTHER" }), binding),
    /SMOKE_FEATURE_NOT_AUTHORIZED/u,
  );
  assert.throws(
    () =>
      authorizeSmokeProfile(
        featureContract({ requiredMutations: ["lead.delete"] }),
        binding,
      ),
    /SMOKE_MUTATION_NOT_AUTHORIZED/u,
  );
  assert.throws(
    () =>
      readHarnessContract(
        {},
        {
          profileId: "production-core",
          requiredMutations: ["lead.create"],
        },
      ),
    /CORE_PROFILE_MUTATION_FORBIDDEN/u,
  );
});

test("authenticated principal and exactly one Organization must match binding", () => {
  const binding = parseSmokeProfileBinding({ ...bindingValue });
  assert.equal(
    validateBootstrapBinding(bootstrapValue(), binding).id,
    bindingValue.organizationId,
  );
  assert.throws(
    () =>
      validateBootstrapBinding(
        bootstrapValue({
          user: { id: "20000000-0000-4000-8000-000000000001" },
        }),
        binding,
      ),
    /SMOKE_PRINCIPAL_ID_MISMATCH/u,
  );
  assert.throws(
    () =>
      validateBootstrapBinding(
        bootstrapValue({ user: { email: "other@example.test" } }),
        binding,
      ),
    /SMOKE_PRINCIPAL_EMAIL_MISMATCH/u,
  );
  assert.throws(
    () =>
      validateBootstrapBinding(
        bootstrapValue({
          organizations: [
            ...bootstrapValue().organizations,
            {
              ...bootstrapValue().organizations[0],
              id: "20000000-0000-4000-8000-000000000002",
              name: "Second Organization",
            },
          ],
        }),
        binding,
      ),
    /SMOKE_ORGANIZATION_CARDINALITY_INVALID/u,
  );
  for (const [field, value, reason] of [
    [
      "id",
      "20000000-0000-4000-8000-000000000002",
      /SMOKE_ORGANIZATION_ID_MISMATCH/u,
    ],
    ["name", "Other Organization", /SMOKE_ORGANIZATION_NAME_MISMATCH/u],
    ["role", "admin", /SMOKE_ORGANIZATION_ROLE_MISMATCH/u],
  ]) {
    assert.throws(
      () =>
        validateBootstrapBinding(
          bootstrapValue({
            organizations: [
              { ...bootstrapValue().organizations[0], [field]: value },
            ],
          }),
          binding,
        ),
      reason,
    );
  }
});

test("feature release identity is deterministic and release-specific", () => {
  const input = {
    dataPrefix: "[GENESIS-SMOKE]",
    featureId: "PIPE-V2-03A",
    functionalSha: "90dc36a3e8a53c1e1852b6acfb8b4c05c97e44e6",
  };
  const first = deriveSyntheticLeadIdentity(input);
  assert.deepEqual(first, deriveSyntheticLeadIdentity(input));
  assert.match(first.displayName, /^\[GENESIS-SMOKE\] PIPE-V2-03A /u);
  assert.match(first.phone, /^629[0-9]{8}$/u);
  assert.notDeepEqual(
    first,
    deriveSyntheticLeadIdentity({
      ...input,
      functionalSha: "80dc36a3e8a53c1e1852b6acfb8b4c05c97e44e6",
    }),
  );
});

test("03A smoke uses captured UUID and has no fixture or local-only dependency", () => {
  const source = readFileSync(
    "test/deployment/features/expected-value-editing.smoke.spec.cjs",
    "utf8",
  );
  assert.match(source, /profileId: ["']production-feature["']/u);
  assert.match(source, /leadCardById\(page, leadId\)/u);
  assert.match(source, /RELEASE_IDENTITY_ALREADY_EXISTS/u);
  assert.match(source, /url\.searchParams\.get\(["']q["']\)/u);
  assert.doesNotMatch(source, /Lead Exemplo|Lead Smoke|options\.first/u);
  assert.doesNotMatch(source, /__test\/reset|direct database|prisma|sql/iu);
  assert.doesNotMatch(source, /REQUIRES_CONTROLLED_LOCAL/u);
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
