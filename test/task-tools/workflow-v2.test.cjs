const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function read(path) {
  return readFileSync(join(process.cwd(), ...path.split('/')), 'utf8');
}

test('CI enforces contracts, formatting and task-tool tests', () => {
  const workflow = read('.github/workflows/ci.yml');
  const packageJson = JSON.parse(read('package.json'));
  const contracts = workflow.indexOf('npm run task:contracts');
  const formatting = workflow.indexOf('npm run format:check:task-tools');
  const tests = workflow.indexOf('npm run test:task-tools');
  const memoryLocal = workflow.indexOf(
    'node scripts/validate-project-memory.cjs --mode local',
  );
  const memoryTests = workflow.indexOf(
    'node --test test/project-memory/project-memory.test.cjs',
  );
  const application = workflow.indexOf('npm run format:check\n');
  assert.ok(contracts > 0);
  assert.ok(formatting > contracts);
  assert.ok(tests > formatting);
  assert.ok(memoryLocal > tests);
  assert.ok(memoryTests > memoryLocal);
  assert.ok(application > memoryTests);
  assert.equal(packageJson.scripts.test, 'vitest run --maxWorkers=1');
});

test('documents explicit Critical Skill invocation and fallback', () => {
  const agents = read('AGENTS.md');
  const prompts = read('docs/PROMPT_TEMPLATES.md');
  const workflow = read('docs/DEVELOPMENT_WORKFLOW.md');
  for (const name of [
    '$genesis-task-orchestrator',
    '$genesis-frontend-product-engineer',
    '$genesis-independent-verifier',
  ]) {
    assert.match(agents, new RegExp(`\\${name}`, 'u'));
    assert.match(prompts, new RegExp(`\\${name}`, 'u'));
  }
  assert.match(
    agents,
    /Orchestrator e Verifier são explicitamente\s+invocados em tarefas Critical/u,
  );
  assert.match(agents, /lente de frontend é aplicada quando o delta exigir/u);
  assert.match(workflow, /três Skills/u);
  assert.match(workflow, /projeção tracked derivada do upstream API/u);
  assert.match(workflow, /dual-read/u);
});

test('keeps the remote operator conceptual and separately authorized', () => {
  const workflow = read('docs/DEVELOPMENT_WORKFLOW.md');
  assert.match(workflow, /remoteOperatorStatus=conceptual-only/u);
  assert.match(workflow, /um\s+writer por recurso compartilhado/u);
  assert.match(workflow, /evidence-manifest\.v1/u);
});

test('binds verifier instance validation to recomputed candidate paths', () => {
  const contracts = read('scripts/task-contracts.cjs');
  assert.match(contracts, /--validate-instance/u);
  assert.match(contracts, /expectedCandidatePaths/u);
  assert.match(contracts, /calculateFingerprint\(\)/u);
  assert.match(
    contracts,
    /verifier evidence requires the recomputed candidate path set/u,
  );
});
