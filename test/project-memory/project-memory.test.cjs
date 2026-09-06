"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const validator = require("../../scripts/validate-project-memory.cjs");

const POINTER = "docs/memory/project-state.pointer.v2.json";
const SCHEMA = "schemas/genesis-harness/project-state.pointer.v2.schema.json";
const FICTIONAL_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function readJson(path) {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function validState(overrides = {}) {
  return {
    schemaVersion: "2.0.0",
    stateRevision: "ROADMAP-WAVE-7-KEEP",
    phase: { id: "ROADMAP-WAVE-7", title: "Fictional product wave" },
    lastCompleted: {
      id: "ROADMAP-WAVE-6",
      title: "Fictional completed work",
      outcome: "KEEP",
    },
    currentWork: { status: "none" },
    nextTask: {
      status: "undecided",
      planningState: "PENDING-PRIORITIZATION",
    },
    live: {
      api: {
        sourceSha: FICTIONAL_SHA,
        image: `ghcr.io/example/platform-api@sha256:${"c".repeat(64)}`,
      },
      web: {
        sourceSha: OTHER_SHA,
        deploymentId: "dpl_1234567890AbCdEfGhIjKlMn",
        domain: "https://example.invalid",
      },
    },
    openBlockers: [],
    activeRestrictions: [],
    followUps: [],
    ...overrides,
  };
}

function temporaryDirectory() {
  const path = mkdtempSync(join(tmpdir(), "genesis-memory-v2-"));
  test.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

function createApiRepository(parent, state = validState()) {
  const root = join(parent, "genesis-platform-api");
  const target = join(root, ...validator.AUTHORITY.path.split("/"));
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, `${JSON.stringify(state, null, 2)}\n`);
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "memory@example.invalid"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Memory Test"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "authority"], { cwd: root });
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return { root, target, sha };
}

test("accepts the checked-in static v2 pointer and strict schema", () => {
  assert.doesNotThrow(() => validator.validatePointer(readJson(POINTER)));
  assert.doesNotThrow(() => validator.validatePointerSchema(readJson(SCHEMA)));
  assert.equal(validator.validateLocal().authority.acceptedSchemaMajor, 2);
});

test("rejects a temporal receipt field", () => {
  const pointer = readJson(POINTER);
  pointer.receipt = { transitionId: "TEMPORAL-RECEIPT" };
  assert.throws(() => validator.validatePointer(pointer), {
    code: "SCHEMA_INVALID",
  });
});

test("rejects current task and phase fields", () => {
  for (const key of ["currentTask", "phase"]) {
    const pointer = readJson(POINTER);
    pointer[key] = "TEMPORAL-VALUE";
    assert.throws(() => validator.validatePointer(pointer), {
      code: "SCHEMA_INVALID",
    });
  }
});

test("rejects a secret-bearing pointer field", () => {
  const pointer = readJson(POINTER);
  pointer.authority.authorizationToken = "not-a-real-secret";
  assert.throws(() => validator.validatePointer(pointer), {
    code: "SECRET_MATERIAL",
  });
});

test("rejects an unsupported pointer schema major", () => {
  const pointer = readJson(POINTER);
  pointer.schemaVersion = "3.0.0";
  assert.throws(() => validator.validatePointer(pointer), {
    code: "UNSUPPORTED_SCHEMA_MAJOR",
  });
});

test("resolves an exact explicit checkout and verifies its commit pin", async () => {
  const api = createApiRepository(temporaryDirectory());
  const result = await validator.resolveAuthority(readJson(POINTER), {
    apiSource: api.root,
    expectedAuthoritySha: api.sha,
  });
  assert.equal(result.strategy, "explicit-checkout");
  assert.equal(result.authoritySha, api.sha);
  assert.equal(result.state.stateRevision, "ROADMAP-WAVE-7-KEEP");
});

test("resolves a sibling API checkout when no explicit source is supplied", async () => {
  const parent = temporaryDirectory();
  const web = join(parent, "genesis-platform-web");
  mkdirSync(web);
  createApiRepository(parent);
  const result = await validator.resolveAuthority(readJson(POINTER), {
    cwd: web,
  });
  assert.equal(result.strategy, "sibling-checkout");
  assert.equal(result.state.schemaVersion, "2.0.0");
});

test("resolves remote read-only authority in a controlled simulation", async () => {
  const pointer = readJson(POINTER);
  const calls = [];
  const result = await validator.resolveAuthority(
    pointer,
    {},
    {
      exists: () => false,
      readRemote: async (url) => {
        calls.push(url);
        return JSON.stringify(validState());
      },
    },
  );
  assert.equal(result.strategy, "remote-read-only");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/main\/docs\/memory\/project-state\.v2\.json$/u);
});

test("fails closed when the selected authority is unavailable", async () => {
  await assert.rejects(
    validator.resolveAuthority(readJson(POINTER), {
      apiSource: join(temporaryDirectory(), "missing-api"),
    }),
    { code: "AUTHORITY_UNAVAILABLE" },
  );
});

test("rejects an expected authority SHA mismatch", async () => {
  const api = createApiRepository(temporaryDirectory());
  await assert.rejects(
    validator.resolveAuthority(readJson(POINTER), {
      apiSource: api.root,
      expectedAuthoritySha: OTHER_SHA,
    }),
    { code: "EXPECTED_AUTHORITY_SHA_MISMATCH" },
  );
});

test("never falls through from a broken explicit source to remote", async () => {
  let remoteReads = 0;
  await assert.rejects(
    validator.resolveAuthority(
      readJson(POINTER),
      { apiSource: join(temporaryDirectory(), "missing-api") },
      {
        readRemote: async () => {
          remoteReads += 1;
          return JSON.stringify(validState());
        },
      },
    ),
    { code: "AUTHORITY_UNAVAILABLE" },
  );
  assert.equal(remoteReads, 0);
});

test("keeps the pointer byte-identical across fictional state changes", () => {
  const before = readFileSync(join(process.cwd(), POINTER));
  validator.validateAuthority(validState());
  validator.validateAuthority(
    validState({
      stateRevision: "ROADMAP-WAVE-8-ROLLBACK",
      currentWork: {
        status: "active",
        id: "ROADMAP-WAVE-8",
        title: "Another fictional task",
      },
      nextTask: {
        status: "decided",
        id: "ROADMAP-WAVE-9",
        title: "Later fictional task",
      },
    }),
  );
  const after = readFileSync(join(process.cwd(), POINTER));
  assert.deepEqual(after, before);
});

test("accepts generic authority instances and rejects malformed live data", () => {
  assert.doesNotThrow(() => validator.validateAuthority(validState()));
  const invalid = validState();
  invalid.live.api.sourceSha = "short";
  assert.throws(() => validator.validateAuthority(invalid), {
    code: "AUTHORITY_SCHEMA_INVALID",
  });
});

test("rejects authority secrets and unsupported schema majors", () => {
  const secret = validState();
  secret.followUps.push({
    id: "SAFE-ID",
    summary: "Bearer abcdefghijklmnopqrstuvwxyz",
  });
  assert.throws(() => validator.validateAuthority(secret), {
    code: "SECRET_MATERIAL",
  });
  assert.throws(
    () => validator.validateAuthority(validState({ schemaVersion: "4.0.0" })),
    { code: "UNSUPPORTED_SCHEMA_MAJOR" },
  );
  assert.throws(
    () => validator.validateAuthority(validState({ schemaVersion: "2x" })),
    { code: "UNSUPPORTED_SCHEMA_MAJOR" },
  );
});

test("contains no current task, receipt, deployment or release hardcodes", () => {
  const source = readFileSync(
    join(process.cwd(), "scripts/validate-project-memory.cjs"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /PIPE-V2-03A|transitionId|targetStateRevision|memoryRevision|90dc36a3|DhUzyz|e0d3613f/u,
  );
});

test("checked-in v1 pointer and schema are removed", () => {
  assert.throws(() =>
    readFileSync(
      join(process.cwd(), "docs/memory/project-state.pointer.v1.json"),
    ),
  );
  assert.throws(() =>
    readFileSync(
      join(
        process.cwd(),
        "schemas/genesis-harness/project-state.pointer.v1.schema.json",
      ),
    ),
  );
});
