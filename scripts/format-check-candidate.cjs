#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync, statSync } = require('node:fs');
const { isAbsolute, join, relative, resolve, sep } = require('node:path');
const prettier = require('prettier');

const GIT_SELECTION_ARGS = [
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
];
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;

function sortPaths(paths) {
  return paths.sort((left, right) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}

function resolveRepoPath(cwd, repoPath) {
  const absolutePath = resolve(cwd, ...repoPath.split('/'));
  const relativePath = relative(cwd, absolutePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Git returned a path outside the repository: ${repoPath}`);
  }
  return absolutePath;
}

function failureDetail(error) {
  const stderr = error?.stderr?.toString('utf8').trim();
  return stderr || error?.message || 'unknown Git error';
}

function discoverGitFiles({
  cwd = process.cwd(),
  execFile = execFileSync,
} = {}) {
  let output;
  try {
    output = execFile('git', GIT_SELECTION_ARGS, {
      cwd,
      maxBuffer: MAX_GIT_OUTPUT_BYTES,
    });
  } catch (error) {
    throw new Error(
      `Unable to construct Git-aware formatter selection: ${failureDetail(error)}`,
      { cause: error },
    );
  }

  const bytes = Buffer.isBuffer(output) ? output : Buffer.from(output);
  const paths = bytes
    .toString('utf8')
    .split('\0')
    .filter((path) => path.length > 0);
  return sortPaths([...new Set(paths)]);
}

async function selectPrettierFiles(
  paths,
  {
    cwd = process.cwd(),
    getFileInfo = prettier.getFileInfo,
    stat = statSync,
  } = {},
) {
  const selected = [];
  for (const repoPath of paths) {
    const absolutePath = resolveRepoPath(cwd, repoPath);
    let fileStatus;
    try {
      fileStatus = stat(absolutePath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (!fileStatus.isFile()) continue;

    const info = await getFileInfo(absolutePath, {
      ignorePath: join(cwd, '.prettierignore'),
      withNodeModules: false,
    });
    if (!info.ignored && info.inferredParser !== null) selected.push(repoPath);
  }
  return selected;
}

async function validateCandidateFormatting({
  cwd = process.cwd(),
  prettierApi = prettier,
  gitFiles,
} = {}) {
  const repositoryRoot = resolve(cwd);
  const candidates = gitFiles ?? discoverGitFiles({ cwd: repositoryRoot });
  const checkedPaths = await selectPrettierFiles(candidates, {
    cwd: repositoryRoot,
    getFileInfo: prettierApi.getFileInfo,
  });
  const checks = await Promise.all(
    checkedPaths.map(async (repoPath) => {
      const absolutePath = resolveRepoPath(repositoryRoot, repoPath);
      const config =
        (await prettierApi.resolveConfig(absolutePath, {
          editorconfig: true,
        })) ?? {};
      const source = readFileSync(absolutePath, 'utf8');
      const formatted = await prettierApi.check(source, {
        ...config,
        filepath: absolutePath,
      });
      return { repoPath, formatted };
    }),
  );

  return {
    candidateFileCount: candidates.length,
    checkedPaths,
    unformattedPaths: checks
      .filter((check) => !check.formatted)
      .map((check) => check.repoPath),
  };
}

async function main() {
  try {
    console.log('Checking formatting for Git candidate files...');
    const result = await validateCandidateFormatting();
    for (const path of result.unformattedPaths) console.warn(`[warn] ${path}`);
    if (result.unformattedPaths.length > 0) {
      console.error(
        `[error] Code style issues found in ${result.unformattedPaths.length} file(s).`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `All matched files use Prettier code style (${result.checkedPaths.length} checked; ${result.candidateFileCount} selected by Git).`,
    );
  } catch (error) {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  GIT_SELECTION_ARGS,
  discoverGitFiles,
  resolveRepoPath,
  selectPrettierFiles,
  validateCandidateFormatting,
};
