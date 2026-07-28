"use strict";

const ALLOWED_FOCUSED_SCRIPTS = new Set([
  "build",
  "format:check",
  "lint",
  "test",
  "test:e2e",
  "test:task-tools",
  "typecheck",
]);

function validateFocusedScripts(scripts) {
  const invalid = scripts.filter(
    (script) => !ALLOWED_FOCUSED_SCRIPTS.has(script),
  );
  if (invalid.length > 0) {
    throw new Error(`Scripts focados não permitidos: ${invalid.join(", ")}.`);
  }
  return scripts;
}

module.exports = { ALLOWED_FOCUSED_SCRIPTS, validateFocusedScripts };
