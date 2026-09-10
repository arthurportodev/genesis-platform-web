import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface VercelConfig {
  functions?: Record<string, { maxDuration?: number }>;
  git?: {
    deploymentEnabled?: boolean | Record<string, boolean>;
  };
  routes?: Array<{
    src?: string;
    dest?: string;
    status?: number;
    handle?: string;
    continue?: boolean;
    headers?: Record<string, string>;
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

  it("suppresses every automatic Git deployment until the operational gate", () => {
    expect(config.git).toEqual({
      deploymentEnabled: false,
    });
  });

  it("routes only the public API namespace to the function and blocks its filesystem name", () => {
    expect(config.routes).toEqual([
      {
        src: "/(.*)",
        headers: {
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https://*.googleusercontent.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "X-Content-Type-Options": "nosniff",
        },
        continue: true,
      },
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
