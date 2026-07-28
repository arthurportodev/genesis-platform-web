"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isLocalArtifact,
  uniqueSorted,
} = require("../../scripts/lib/task-candidate.cjs");

test("exclui apenas artefatos operacionais locais dentro de .codex", () => {
  assert.equal(isLocalArtifact(".codex/task-manifest.json"), true);
  assert.equal(isLocalArtifact(".codex/task-packets/1.2.3.md"), true);
  assert.equal(isLocalArtifact(".codex/task-manifest.example.json"), false);
});

test("normaliza, ordena e remove candidatos duplicados", () => {
  assert.deepEqual(uniqueSorted(["src\\b.ts", "src/a.ts", "src/a.ts"]), [
    "src/a.ts",
    "src/b.ts",
  ]);
});
