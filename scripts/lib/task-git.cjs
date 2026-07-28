"use strict";

const { spawnSync } = require("node:child_process");

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `git ${args.join(" ")} falhou${detail ? `: ${detail}` : "."}`,
    );
  }

  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

module.exports = { lines, runGit };
