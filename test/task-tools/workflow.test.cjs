"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.resolve(__dirname, "../../.github/workflows/ci.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

test("workflow valida pull requests, main e execução manual", () => {
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/u);
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /name: Validate frontend/u);
});

test("workflow preserva controles e não publica artefatos", () => {
  for (const command of [
    "npm ci",
    "npm run format:check",
    "npm run lint",
    "npm run typecheck",
    "npm run test:task-tools",
    "npm test",
    "npm run build",
    "npm run test:e2e",
  ]) {
    assert.ok(workflow.includes(command), `comando ausente: ${command}`);
  }
  assert.match(workflow, /permissions:\s*\n\s+contents: read/u);
  assert.doesNotMatch(
    workflow,
    /upload-artifact|playwright-report\/|screenshots?|traces?|videos?/iu,
  );
});
