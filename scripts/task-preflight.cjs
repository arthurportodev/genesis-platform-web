"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { collectCandidatePaths } = require("./lib/task-candidate.cjs");
const {
  validateFocusedScripts,
} = require("./lib/task-focused-script-policy.cjs");
const { lines, runGit } = require("./lib/task-git.cjs");
const { loadManifest, pathIsAllowed } = require("./lib/task-manifest.cjs");

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"]{8,}['"]/iu,
];

function inspectCandidatePaths(manifest, candidatePaths, root) {
  const outsideScope = candidatePaths.filter(
    (candidate) => !pathIsAllowed(manifest, candidate),
  );
  if (outsideScope.length > 0) {
    throw new Error(`Arquivos fora do escopo: ${outsideScope.join(", ")}.`);
  }

  const secretFindings = [];
  for (const candidate of candidatePaths) {
    const absolute = path.join(root, candidate);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory())
      continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
      secretFindings.push(candidate);
    }
  }
  if (secretFindings.length > 0) {
    throw new Error(
      `Possível segredo encontrado em: ${secretFindings.join(", ")}.`,
    );
  }
}

function runPreflight(root = process.cwd()) {
  const { manifest } = loadManifest(root);
  validateFocusedScripts(manifest.validation.focusedScripts);

  const branch = runGit(["branch", "--show-current"], { cwd: root }).stdout;
  if (branch !== manifest.git.branch) {
    throw new Error(
      `Branch atual ${branch || "(detached)"} difere de ${manifest.git.branch}.`,
    );
  }

  runGit(["cat-file", "-e", `${manifest.git.baseSha}^{commit}`], { cwd: root });
  const ancestor = runGit(
    ["merge-base", "--is-ancestor", manifest.git.baseSha, "HEAD"],
    { cwd: root, allowFailure: true },
  );
  if (ancestor.status !== 0) {
    throw new Error("O SHA-base não é ancestral de HEAD.");
  }

  if (manifest.git.requireCleanStage) {
    const staged = lines(
      runGit(["diff", "--cached", "--name-only"], { cwd: root }).stdout,
    );
    if (staged.length > 0) {
      throw new Error(`O estágio Git deve estar vazio: ${staged.join(", ")}.`);
    }
  }

  const packetPath = path.join(root, manifest.artifacts.taskPacket);
  if (!fs.existsSync(packetPath)) {
    throw new Error(`Task Packet ausente: ${manifest.artifacts.taskPacket}.`);
  }

  const ignored = runGit(
    [
      "check-ignore",
      ".codex/task-manifest.json",
      manifest.artifacts.taskPacket,
    ],
    { cwd: root, allowFailure: true },
  );
  if (ignored.status !== 0 || lines(ignored.stdout).length !== 2) {
    throw new Error(
      "Manifesto e Task Packet locais devem estar ignorados pelo Git.",
    );
  }

  const candidates = collectCandidatePaths(manifest.git.baseSha, root);
  inspectCandidatePaths(manifest, candidates, root);

  console.log(
    `Preflight aprovado para ${manifest.task.id} (classe ${manifest.task.class}; perfil ${manifest.validation.profile}).`,
  );
  console.log(`Branch: ${branch}`);
  console.log(`Base: ${manifest.git.baseSha}`);
  console.log(`Arquivos candidatos: ${candidates.length}`);
  return { manifest, candidates };
}

if (require.main === module) {
  try {
    runPreflight();
  } catch (error) {
    console.error(`Preflight reprovado: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { SECRET_PATTERNS, inspectCandidatePaths, runPreflight };
