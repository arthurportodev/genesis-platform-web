"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { validationPlan } = require("../../scripts/task-validate.cjs");

test("perfil critical cobre ferramentas, aplicação, build e E2E", () => {
  const plan = validationPlan({
    validation: { profile: "critical", focusedScripts: [] },
  });

  assert.deepEqual(plan, [
    "task:preflight",
    "format:check:task-tools",
    "test:task-tools",
    "format:check",
    "lint",
    "typecheck",
    "test",
    "build",
    "test:e2e",
    "task:fingerprint",
  ]);
});

test("perfil focused rejeita scripts que executariam governança recursiva", () => {
  assert.throws(
    () =>
      validationPlan({
        validation: { profile: "focused", focusedScripts: ["task:validate"] },
      }),
    /não permitidos/u,
  );
});
