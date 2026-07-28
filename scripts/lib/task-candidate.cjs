"use strict";

const { lines, runGit } = require("./task-git.cjs");
const { normalizePath } = require("./task-manifest.cjs");

const LOCAL_MANIFEST = ".codex/task-manifest.json";
const LOCAL_PACKET_PREFIX = ".codex/task-packets/";

function isLocalArtifact(candidate) {
  const normalized = normalizePath(candidate);
  return (
    normalized === LOCAL_MANIFEST || normalized.startsWith(LOCAL_PACKET_PREFIX)
  );
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizePath))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function collectCandidatePaths(baseSha, cwd = process.cwd()) {
  const committed = lines(
    runGit(["diff", "--name-only", `${baseSha}...HEAD`], { cwd }).stdout,
  );
  const unstaged = lines(runGit(["diff", "--name-only"], { cwd }).stdout);
  const staged = lines(
    runGit(["diff", "--cached", "--name-only"], { cwd }).stdout,
  );
  const untracked = lines(
    runGit(["ls-files", "--others", "--exclude-standard"], { cwd }).stdout,
  );

  return uniqueSorted([
    ...committed,
    ...unstaged,
    ...staged,
    ...untracked,
  ]).filter((candidate) => !isLocalArtifact(candidate));
}

module.exports = { collectCandidatePaths, isLocalArtifact, uniqueSorted };
