'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const {
  discoverGitFiles,
  selectPrettierFiles,
  validateCandidateFormatting,
} = require('../../scripts/format-check-candidate.cjs');

const FIXTURES = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'genesis-format-selection-'));
  FIXTURES.push(root);
  execFileSync('git', ['init', '--quiet'], { cwd: root });

  mkdirSync(join(root, '.codex', 'task-packets'), { recursive: true });
  mkdirSync(join(root, 'folder with space'), { recursive: true });
  writeFileSync(join(root, 'tracked.js'), 'const tracked = true;\n');
  writeFileSync(join(root, 'new-legit.js'), 'const value={answer:42}\n');
  writeFileSync(join(root, 'ignored.js'), 'const ignored={value:true}\n');
  writeFileSync(
    join(root, '.codex', 'task-packets', 'old-artifact.json'),
    '{"ignored":true}',
  );
  writeFileSync(join(root, 'asset.bin'), Buffer.from([0, 1, 2, 3]));
  writeFileSync(
    join(root, 'folder with space', 'supported file.js'),
    'const spaced = true;\n',
  );
  execFileSync('git', ['add', '--', 'tracked.js'], { cwd: root });
  appendFileSync(
    join(root, '.git', 'info', 'exclude'),
    '\nignored.js\n.codex/task-packets/\n',
  );
  return root;
}

test.afterEach(() => {
  for (const root of FIXTURES.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses Git candidate semantics before selecting supported Prettier files', async () => {
  const root = fixture();
  const gitFiles = discoverGitFiles({ cwd: root });

  assert.deepEqual(gitFiles, [
    'asset.bin',
    'folder with space/supported file.js',
    'new-legit.js',
    'tracked.js',
  ]);
  assert.equal(gitFiles.includes('ignored.js'), false);
  assert.equal(
    gitFiles.includes('.codex/task-packets/old-artifact.json'),
    false,
  );

  const prettierFiles = await selectPrettierFiles(gitFiles, { cwd: root });
  assert.deepEqual(prettierFiles, [
    'folder with space/supported file.js',
    'new-legit.js',
    'tracked.js',
  ]);

  const result = await validateCandidateFormatting({ cwd: root, gitFiles });
  assert.equal(result.checkedPaths.includes('new-legit.js'), true);
  assert.equal(result.checkedPaths.includes('asset.bin'), false);
  assert.deepEqual(result.unformattedPaths, ['new-legit.js']);
});

test('fails closed with a clear diagnostic when Git discovery fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'genesis-format-no-git-'));
  FIXTURES.push(root);

  assert.throws(
    () => discoverGitFiles({ cwd: root }),
    /Unable to construct Git-aware formatter selection/u,
  );
});
