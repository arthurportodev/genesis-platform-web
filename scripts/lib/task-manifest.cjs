"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TASK_CLASSES = new Set(["Simple", "Normal", "Critical"]);
const VALIDATION_PROFILES = new Set(["docs", "focused", "normal", "critical"]);

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function matchesPath(pattern, candidate) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedCandidate = normalizePath(candidate);

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return (
      normalizedCandidate === prefix ||
      normalizedCandidate.startsWith(`${prefix}/`)
    );
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -2);
    const remainder = normalizedCandidate.slice(prefix.length + 1);
    return (
      normalizedCandidate.startsWith(`${prefix}/`) && !remainder.includes("/")
    );
  }

  return normalizedPattern === normalizedCandidate;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} deve ser uma string não vazia.`);
  }
}

function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1) {
    throw new Error("Manifesto ausente ou com versão incompatível.");
  }

  assertString(manifest.task?.id, "task.id");
  assertString(manifest.task?.title, "task.title");
  if (!TASK_CLASSES.has(manifest.task?.class)) {
    throw new Error("task.class deve ser Simple, Normal ou Critical.");
  }

  assertString(manifest.git?.branch, "git.branch");
  if (!/^[0-9a-f]{40}$/i.test(manifest.git?.baseSha ?? "")) {
    throw new Error("git.baseSha deve ser um SHA completo de 40 caracteres.");
  }

  if (
    !Array.isArray(manifest.scope?.allowedPaths) ||
    manifest.scope.allowedPaths.length === 0
  ) {
    throw new Error("scope.allowedPaths deve conter ao menos um caminho.");
  }
  if (!Array.isArray(manifest.scope?.protectedPaths)) {
    throw new Error("scope.protectedPaths deve ser uma lista.");
  }
  assertString(manifest.artifacts?.taskPacket, "artifacts.taskPacket");
  if (!VALIDATION_PROFILES.has(manifest.validation?.profile)) {
    throw new Error(
      "validation.profile deve ser docs, focused, normal ou critical.",
    );
  }
  if (
    manifest.task.class === "Critical" &&
    manifest.validation.profile !== "critical"
  ) {
    throw new Error("Tarefas Critical exigem o perfil critical.");
  }
  if (!Array.isArray(manifest.validation?.focusedScripts)) {
    throw new Error("validation.focusedScripts deve ser uma lista.");
  }

  return manifest;
}

function loadManifest(root = process.cwd()) {
  const manifestPath = path.join(root, ".codex", "task-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Manifesto local ausente. Crie .codex/task-manifest.json a partir do exemplo.",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Não foi possível ler o manifesto: ${error.message}`);
  }

  return { manifest: validateManifest(parsed), manifestPath };
}

function pathIsAllowed(manifest, candidate) {
  const protectedMatch = manifest.scope.protectedPaths.some((pattern) =>
    matchesPath(pattern, candidate),
  );
  const allowedMatch = manifest.scope.allowedPaths.some((pattern) =>
    matchesPath(pattern, candidate),
  );
  return allowedMatch && !protectedMatch;
}

module.exports = {
  TASK_CLASSES,
  VALIDATION_PROFILES,
  loadManifest,
  matchesPath,
  normalizePath,
  pathIsAllowed,
  validateManifest,
};
