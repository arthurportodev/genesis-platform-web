"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { collectCandidatePaths } = require("./lib/task-candidate.cjs");
const { loadManifest } = require("./lib/task-manifest.cjs");

function createFingerprint({ baseSha, candidates, root }) {
  const hash = crypto.createHash("sha256");
  hash.update(`base\0${baseSha}\0`);

  for (const candidate of [...candidates].sort((a, b) => a.localeCompare(b))) {
    const absolute = path.join(root, candidate);
    hash.update(`path\0${candidate}\0`);
    if (!fs.existsSync(absolute)) {
      hash.update("deleted\0");
      continue;
    }
    hash.update(fs.readFileSync(absolute));
    hash.update("\0");
  }

  return hash.digest("hex");
}

function runFingerprint(root = process.cwd(), options = {}) {
  const { manifest } = loadManifest(root);
  const candidates = collectCandidatePaths(manifest.git.baseSha, root);
  const fingerprint = createFingerprint({
    baseSha: manifest.git.baseSha,
    candidates,
    root,
  });
  const result = {
    task: manifest.task.id,
    base: manifest.git.baseSha,
    files: candidates.length,
    sha256: fingerprint,
    candidates,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`task=${result.task}`);
    console.log(`base=${result.base}`);
    console.log(`files=${result.files}`);
    console.log(`sha256=${result.sha256}`);
  }
  return result;
}

if (require.main === module) {
  try {
    runFingerprint(process.cwd(), { json: process.argv.includes("--json") });
  } catch (error) {
    console.error(`Fingerprint falhou: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createFingerprint, runFingerprint };
