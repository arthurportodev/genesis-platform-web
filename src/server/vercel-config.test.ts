import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface VercelConfig {
  functions?: Record<string, { maxDuration?: number }>;
  git?: {
    deploymentEnabled?: Record<string, boolean>;
  };
  routes?: Array<{
    src?: string;
    dest?: string;
    status?: number;
    handle?: string;
  }>;
}

describe("Vercel production routing contract", () => {
  const config = JSON.parse(
    readFileSync("vercel.json", "utf8"),
  ) as VercelConfig;

  it("uses the official Node runtime selected by package engines", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      engines?: { node?: string };
    };
    expect(packageJson.engines?.node).toBe("24.x");
    expect(config.functions).toEqual({
      "api/proxy.ts": { maxDuration: 10 },
    });
  });

  it("suppresses automatic deployments only for the verification branch", () => {
    expect(config.git).toEqual({
      deploymentEnabled: {
        "codex/0.8-mvp-08-api-web": false,
      },
    });
    expect(config.git?.deploymentEnabled?.main).toBeUndefined();
  });

  it("routes only the public API namespace to the function and blocks its filesystem name", () => {
    expect(config.routes).toEqual([
      {
        src: "/api/v1",
        dest: "/api/proxy?__genesis_proxy_path=",
      },
      {
        src: "/api/v1/(.*)",
        dest: "/api/proxy?__genesis_proxy_path=$1",
      },
      { src: "/api/proxy(?:/.*)?", status: 404 },
      { handle: "filesystem" },
      { src: "/api/v1(?:/.*)?", status: 404 },
      { src: "/.*", dest: "/index.html" },
    ]);
  });
});
