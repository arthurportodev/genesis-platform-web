"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const REPOSITORY_ROOT = process.cwd();
const SCRIPT = join(REPOSITORY_ROOT, "scripts", "validate-project-memory.cjs");
const POINTER = "docs/memory/project-state.pointer.v1.json";
const SCHEMA = "schemas/genesis-harness/project-state.pointer.v1.schema.json";
const BRIDGE = "docs/CURRENT_STATE.md";
const FIXTURES = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "genesis-memory-"));
  FIXTURES.push(root);
  for (const path of [POINTER, SCHEMA, BRIDGE]) {
    const target = join(root, ...path.split("/"));
    mkdirSync(join(target, ".."), { recursive: true });
    cpSync(join(REPOSITORY_ROOT, ...path.split("/")), target);
  }
  return root;
}

function readJson(root, path = POINTER) {
  return JSON.parse(readFileSync(join(root, ...path.split("/")), "utf8"));
}

function writeJson(root, value, path = POINTER) {
  writeFileSync(
    join(root, ...path.split("/")),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function run(root, args = ["--mode", "local"]) {
  const execution = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    ...execution,
    result: execution.stdout ? JSON.parse(execution.stdout) : null,
  };
}

function expectCode(execution, code, status = 1) {
  assert.equal(execution.status, status, execution.stderr);
  assert.equal(execution.result.ok, false);
  assert.ok(execution.result.codes.includes(code));
  assert.ok(execution.stderr.length > 0);
}

function expectApiAuthorityOnlyNextAction(execution) {
  expectCode(execution, "MEMORY_STABLE_SOURCE_HAS_STATE");
  assert.match(execution.result.nextAction, /canonical API authority/u);
  assert.doesNotMatch(
    execution.result.nextAction,
    /marker|snapshot|hist[oó]rico|superseded/iu,
  );
}

function authority(
  memoryRevision,
  stateRevision = "MVP-10D-WEB-INTEGRATED-2026-08-24",
) {
  return {
    schemaVersion: "1.0.0",
    instanceKind: "current",
    stateRevision,
    project: { id: "genesis-platform", name: "Genesis Platform" },
    authority: {
      repository: "arthurportodev/genesis-platform-api",
      branch: "main",
      path: "docs/memory/project-state.v1.json",
      revisionSource: "containing-commit",
    },
    repositories: [
      {
        id: "web",
        repository: "arthurportodev/genesis-platform-web",
        memoryRevision: { kind: "commit", sha: memoryRevision },
      },
    ],
    releaseBindings: { webIntegratedRevision: memoryRevision },
  };
}

function initializeGit(root) {
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "memory@example.invalid"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Memory Fixture"], {
    cwd: root,
  });
  execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
  execFileSync("git", ["config", "core.safecrlf", "false"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: root });
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

test.after(() => {
  for (const root of FIXTURES) rmSync(root, { recursive: true, force: true });
});

test("accepts the reviewed pointer, bridge, schema and stable sources", () => {
  const execution = run(fixture());
  assert.equal(execution.status, 0, execution.stderr);
  assert.deepEqual(execution.result, {
    ok: true,
    code: "POINTER_VALID",
    pointerContractValidated: true,
    pointerSemanticRulesValidated: true,
    schemaPrototypeParsed: true,
    stableSourcesValidated: true,
    authorityResolved: false,
  });
  assert.equal(execution.stderr, "");
});

test("rejects invalid JSON", () => {
  const root = fixture();
  writeFileSync(join(root, ...POINTER.split("/")), "{", "utf8");
  expectCode(run(root), "MEMORY_PARSE_ERROR");
});

test("rejects non-UTF-8 input", () => {
  const root = fixture();
  writeFileSync(join(root, ...POINTER.split("/")), Buffer.from([0xff, 0xfe]));
  expectCode(run(root), "MEMORY_PARSE_ERROR");
});

test("rejects an unsupported schema major", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.schemaVersion = "2.0.0";
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_SCHEMA_UNSUPPORTED");
});

test("rejects divergent nested pointer schema contracts", () => {
  for (const mutate of [
    (schema) => {
      schema.properties.receipt.properties.revisionSource.const =
        "integrated-revision";
    },
    (schema) => {
      schema.properties.authority.properties.repository.const =
        "example.invalid/wrong-authority";
    },
    (schema) => {
      schema.properties.receipt.required =
        schema.properties.receipt.required.filter((key) => key !== "baseSha");
    },
    (schema) => {
      schema.properties.receipt.properties.baseSha.pattern = "^[a-f0-9]+$";
    },
  ]) {
    const root = fixture();
    const schema = readJson(root, SCHEMA);
    mutate(schema);
    writeJson(root, schema, SCHEMA);
    expectCode(run(root), "MEMORY_SCHEMA_INVALID");
  }
});

test("rejects an unknown pointer property", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.note = "benign but not allowed";
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_SCHEMA_INVALID");
});

for (const key of [
  "phase",
  "currentWork",
  "nextTask",
  "operationalState",
  "blockers",
  "pendingHumanDecisions",
  "currentRestrictions",
  "production",
  "productionFacts",
  "productionState",
  "hostname",
  "hostnames",
  "currentTask",
  "lastCompleted",
  "projectState",
  "stateCopy",
  "facts",
  "documentedAt",
  "observedAt",
]) {
  test(`rejects forbidden temporal field ${key} recursively`, () => {
    const root = fixture();
    const pointer = readJson(root);
    pointer.authority.extension = { nested: { [key]: "forbidden" } };
    writeJson(root, pointer);
    expectCode(run(root), "MEMORY_POINTER_TEMPORAL_DATA");
  });
}

test("rejects a secret-bearing field recursively", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.receipt.authorizationToken = "not-a-real-token";
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_POINTER_SECRET");
});

test("rejects a malformed or wrong base SHA", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.receipt.baseSha = "a".repeat(40);
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_SCHEMA_INVALID");
});

test("rejects a wrong transition identity or target state revision", () => {
  for (const mutate of [
    (pointer) => {
      pointer.receipt.transitionId = "MVP-10F-CROSS-REPO";
    },
    (pointer) => {
      pointer.receipt.targetStateRevision = "MVP-10B-LIVE-2026-08-21";
    },
  ]) {
    const root = fixture();
    const pointer = readJson(root);
    mutate(pointer);
    writeJson(root, pointer);
    expectCode(run(root), "MEMORY_SCHEMA_INVALID");
  }
});

test("rejects invalid receipt provenance", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.receipt.revisionSource = "integrated-revision";
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_SCHEMA_INVALID");
});

test("rejects a malformed timestamp", () => {
  const root = fixture();
  const pointer = readJson(root);
  pointer.receipt.generatedAt = "2026-02-31T12:00:00Z";
  writeJson(root, pointer);
  expectCode(run(root), "MEMORY_SCHEMA_INVALID");
});

test("rejects temporal facts in the bridge", () => {
  const root = fixture();
  writeFileSync(
    join(root, ...BRIDGE.split("/")),
    "<!-- genesis-memory-bridge:v1 -->\nAUTHORITY_UNAVAILABLE\nMEMORY_TRANSITION_PENDING\nA fase atual é 0.8.\n",
    "utf8",
  );
  expectCode(run(root), "MEMORY_STABLE_SOURCE_HAS_STATE");
});

test("rejects a history marker outside the explicit allowlist", () => {
  const root = fixture();
  writeFileSync(
    join(root, "README.md"),
    "<!-- genesis-memory-history:v1 -->\n# histórico/superseded\nA próxima tarefa era 0.8.2 na época.\n",
    "utf8",
  );
  const execution = run(root);
  expectCode(execution, "MEMORY_HISTORY_MARKER_NOT_ALLOWED");
});

test("allows a wholly labeled historical roadmap snapshot", () => {
  const root = fixture();
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(
    join(root, "docs", "ROADMAP.md"),
    "<!-- genesis-memory-history:v1 -->\n# Roadmap — snapshot histórico/superseded\nA próxima tarefa era 0.8.2 na época.\n",
    "utf8",
  );
  assert.equal(run(root).status, 0);
});

test("rejects a historical roadmap without a whole-document label", () => {
  const root = fixture();
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(
    join(root, "docs", "ROADMAP.md"),
    "<!-- genesis-memory-history:v1 -->\n# Roadmap\nA próxima tarefa era 0.8.2 na época.\n",
    "utf8",
  );
  expectCode(run(root), "MEMORY_STABLE_SOURCE_HAS_STATE");
});

for (const hostname of [
  "app.agenciagenesis.com.br",
  "app.agenciagenesismkt.com.br",
]) {
  test(`rejects hardcoded operational hostname ${hostname}`, () => {
    const root = fixture();
    writeFileSync(
      join(root, "README.md"),
      `# Stable source\nO hostname operacional é ${hostname}.\n`,
      "utf8",
    );
    expectApiAuthorityOnlyNextAction(run(root));
  });
}

test("gives API-authority-only guidance for a temporal README fact", () => {
  const root = fixture();
  writeFileSync(
    join(root, "README.md"),
    "# Stable source\nA próxima tarefa é 0.8.2.\n",
    "utf8",
  );
  expectApiAuthorityOnlyNextAction(run(root));
});

test("rejects an old roadmap presented as current", () => {
  const root = fixture();
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(
    join(root, "docs", "ROADMAP.md"),
    "# Roadmap\nA próxima tarefa é 0.8.2 na Hetzner.\n",
    "utf8",
  );
  const execution = run(root);
  expectCode(execution, "MEMORY_STABLE_SOURCE_HAS_STATE");
  assert.match(execution.result.nextAction, /canonical API authority/u);
  assert.match(
    execution.result.nextAction,
    /entire document hist[oó]rico\/superseded/iu,
  );
});

test("reports authority unavailable and transition pending together", () => {
  const root = fixture();
  const execution = run(root, [
    "--mode",
    "resolve",
    "--api-source",
    join(root, "missing-api"),
  ]);
  expectCode(execution, "AUTHORITY_UNAVAILABLE");
  assert.ok(execution.result.codes.includes("MEMORY_TRANSITION_PENDING"));
  assert.equal(execution.result.staleFallbackUsed, false);
});

test("reports a receipt whose target revision is not activated", () => {
  const root = fixture();
  const source = join(root, "authority.json");
  writeJson(
    root,
    authority("a".repeat(40), "MVP-10B-LIVE-2026-08-21"),
    "authority.json",
  );
  const execution = run(root, ["--mode", "resolve", "--api-source", source]);
  expectCode(execution, "MEMORY_TRANSITION_PENDING");
  assert.equal(execution.result.authorityResolved, true);
});

test("reports a mismatched Web memoryRevision", () => {
  const root = fixture();
  const commit = initializeGit(root);
  const source = join(root, "authority.json");
  const different = commit === "a".repeat(40) ? "b".repeat(40) : "a".repeat(40);
  writeJson(root, authority(different), "authority.json");
  const execution = run(root, ["--mode", "resolve", "--api-source", source]);
  expectCode(execution, "MEMORY_WEB_REVISION_MISMATCH");
  assert.equal(execution.result.actualMemoryRevision, commit);
});

test("resolves a compatible authority at the clean containing commit", () => {
  const root = fixture();
  const commit = initializeGit(root);
  const source = join(root, "authority.json");
  writeJson(root, authority(commit), "authority.json");
  const execution = run(root, ["--mode", "resolve", "--api-source", source]);
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.result.code, "MEMORY_RESOLVED");
  assert.equal(execution.result.webMemoryRevision, commit);
  assert.equal(execution.result.staleFallbackUsed, false);
});

test("does not resolve an uncommitted pointer", () => {
  const root = fixture();
  const commit = initializeGit(root);
  const pointer = readJson(root);
  pointer.receipt.generatedAt = "2026-08-24T14:19:54.2261794Z";
  writeJson(root, pointer);
  const source = join(root, "authority.json");
  writeJson(root, authority(commit), "authority.json");
  const execution = run(root, ["--mode", "resolve", "--api-source", source]);
  expectCode(execution, "MEMORY_TRANSITION_PENDING");
  assert.equal(execution.result.transitionPending, true);
});

test("rejects divergent API Web bindings", () => {
  const root = fixture();
  const commit = initializeGit(root);
  const source = join(root, "authority.json");
  const candidate = authority(commit);
  candidate.releaseBindings.webIntegratedRevision = "a".repeat(40);
  writeJson(root, candidate, "authority.json");
  const execution = run(root, ["--mode", "resolve", "--api-source", source]);
  expectCode(execution, "MEMORY_AUTHORITY_INVALID");
});

test("never treats CURRENT_STATE content as authority fallback", () => {
  const root = fixture();
  writeFileSync(
    join(root, ...BRIDGE.split("/")),
    "<!-- genesis-memory-bridge:v1 -->\nAUTHORITY_UNAVAILABLE\nMEMORY_TRANSITION_PENDING\nGH-FAKE-FALLBACK\n",
    "utf8",
  );
  const execution = run(root, [
    "--mode",
    "resolve",
    "--api-source",
    join(root, "missing-api"),
  ]);
  expectCode(execution, "AUTHORITY_UNAVAILABLE");
  assert.doesNotMatch(execution.stdout, /GH-FAKE-FALLBACK/u);
  assert.equal(execution.result.staleFallbackUsed, false);
});

test("rejects irregular pointer input", () => {
  const root = fixture();
  rmSync(join(root, ...POINTER.split("/")));
  mkdirSync(join(root, ...POINTER.split("/")));
  expectCode(run(root), "MEMORY_UNSAFE_INPUT");
});

test("returns exit 2 for invalid usage", () => {
  const execution = run(fixture(), ["--mode", "resolve"]);
  expectCode(execution, "USAGE_ERROR", 2);
});

test("uses temporary fixtures without copying repository .codex state", () => {
  const root = fixture();
  assert.equal(run(root).status, 0);
  assert.equal(existsSync(join(root, ".codex")), false);
});

test("accepts the complete corrected candidate", () => {
  const execution = run(REPOSITORY_ROOT);
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.result.code, "POINTER_VALID");
  assert.equal(execution.result.stableSourcesValidated, true);
});

test("CI invokes memory checks in the existing job", () => {
  const workflow = readFileSync(
    join(REPOSITORY_ROOT, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /node scripts\/validate-project-memory\.cjs --mode local/u,
  );
  assert.match(
    workflow,
    /node --test test\/project-memory\/project-memory\.test\.cjs/u,
  );
  assert.equal((workflow.match(/name: Validate frontend/gu) ?? []).length, 1);
});
