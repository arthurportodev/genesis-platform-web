"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { inspectCandidatePaths } = require("../../scripts/task-preflight.cjs");

function scopedManifest() {
  return {
    scope: { allowedPaths: ["src/**"], protectedPaths: ["src/private/**"] },
  };
}

test("preflight de candidatos rejeita caminho fora do escopo", () => {
  assert.throws(
    () => inspectCandidatePaths(scopedManifest(), ["README.md"], process.cwd()),
    /fora do escopo/u,
  );
});

test("preflight de candidatos rejeita segredo óbvio", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "genesis-preflight-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "src"));
  const keyName = ["api", "key"].join("_");
  fs.writeFileSync(
    path.join(root, "src", "config.ts"),
    `${keyName}="1234567890"`,
  );

  assert.throws(
    () => inspectCandidatePaths(scopedManifest(), ["src/config.ts"], root),
    /segredo/u,
  );
});
