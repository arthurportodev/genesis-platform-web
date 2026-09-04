const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");

const {
  readHarnessContract,
} = require("./scripts/deployment/web-smoke-harness.cjs");

const contract = readHarnessContract();

module.exports = defineConfig({
  testDir: path.resolve(__dirname, "test/deployment"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["line"]],
  globalSetup: contract.usesLocalFixtures
    ? path.resolve(__dirname, "test/e2e/global-setup.ts")
    : undefined,
  use: {
    baseURL: contract.baseURL,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
