"use strict";

const { spawnSync } = require("node:child_process");

const {
  validateFocusedScripts,
} = require("./lib/task-focused-script-policy.cjs");
const { loadManifest } = require("./lib/task-manifest.cjs");

const standardChecks = ["format:check", "lint", "typecheck", "test", "build"];

function validationPlan(manifest) {
  switch (manifest.validation.profile) {
    case "docs":
      return ["task:preflight", "format:check:task-tools", "task:fingerprint"];
    case "focused":
      return [
        "task:preflight",
        ...validateFocusedScripts(manifest.validation.focusedScripts),
        "task:fingerprint",
      ];
    case "normal":
      return ["task:preflight", ...standardChecks, "task:fingerprint"];
    case "critical":
      return [
        "task:preflight",
        "format:check:task-tools",
        "test:task-tools",
        ...standardChecks,
        "test:e2e",
        "task:fingerprint",
      ];
    default:
      throw new Error(`Perfil desconhecido: ${manifest.validation.profile}.`);
  }
}

function runNpmScript(script, root) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error("Execute a validação pelo script npm run task:validate.");
  }
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(
      `Não foi possível iniciar npm run ${script}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`npm run ${script} falhou.`);
  }
}

function runValidation(root = process.cwd()) {
  const { manifest } = loadManifest(root);
  const plan = validationPlan(manifest);
  console.log(`Plano ${manifest.validation.profile}: ${plan.join(" -> ")}`);
  for (const script of plan) runNpmScript(script, root);
  console.log(`Validação ${manifest.validation.profile} aprovada.`);
  return plan;
}

if (require.main === module) {
  try {
    runValidation();
  } catch (error) {
    console.error(`Validação reprovada: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { runValidation, validationPlan };
