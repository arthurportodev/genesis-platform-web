"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  matchesPath,
  pathIsAllowed,
  validateManifest,
} = require("../../scripts/lib/task-manifest.cjs");

function manifest(overrides = {}) {
  return {
    version: 1,
    task: { id: "1.2.3", title: "Teste", class: "Normal" },
    git: {
      branch: "feat/1.2.3-teste",
      baseSha: "a".repeat(40),
      requireCleanStage: true,
    },
    scope: { allowedPaths: ["src/**"], protectedPaths: ["src/secret/**"] },
    artifacts: { taskPacket: ".codex/task-packets/1.2.3.md" },
    validation: { profile: "focused", focusedScripts: ["test"] },
    ...overrides,
  };
}

test("valida um manifesto coerente", () => {
  assert.equal(validateManifest(manifest()).task.id, "1.2.3");
});

test("permite classe Normal com perfil focused", () => {
  assert.equal(validateManifest(manifest()).validation.profile, "focused");
});

test("rejeita classe de tarefa que é apenas perfil técnico", () => {
  assert.throws(
    () =>
      validateManifest(
        manifest({ task: { id: "1.2.3", title: "Teste", class: "docs" } }),
      ),
    /Simple, Normal ou Critical/u,
  );
});

test("impede tarefa Critical de reduzir o perfil", () => {
  assert.throws(
    () =>
      validateManifest(
        manifest({
          task: { id: "1.2.3", title: "Teste", class: "Critical" },
          validation: { profile: "normal", focusedScripts: [] },
        }),
      ),
    /Critical exigem o perfil critical/u,
  );
});

test("resolve padrões recursivos e respeita caminhos protegidos", () => {
  const value = manifest();
  assert.equal(matchesPath("src/**", "src/app/App.tsx"), true);
  assert.equal(pathIsAllowed(value, "src/app/App.tsx"), true);
  assert.equal(pathIsAllowed(value, "src/secret/key.ts"), false);
  assert.equal(pathIsAllowed(value, "README.md"), false);
});
