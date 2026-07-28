"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createFingerprint } = require("../../scripts/task-fingerprint.cjs");

test("fingerprint é determinístico e sensível ao conteúdo", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "genesis-fingerprint-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "a.txt"), "primeiro");

  const input = { baseSha: "a".repeat(40), candidates: ["a.txt"], root };
  const first = createFingerprint(input);
  assert.equal(first, createFingerprint(input));

  fs.writeFileSync(path.join(root, "a.txt"), "segundo");
  assert.notEqual(first, createFingerprint(input));
});
