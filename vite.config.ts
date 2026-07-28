import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function failClosedApiPlugin(enabled: boolean): Plugin {
  return {
    name: "genesis-api-fail-closed",
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use("/api/v1", (_request, response) => {
        response.statusCode = 503;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(
          JSON.stringify({
            statusCode: 503,
            message:
              "Integração local indisponível: configure GENESIS_API_PROXY_TARGET.",
          }),
        );
      });
    },
  };
}

function parseProxyTarget(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  let target: URL;
  try {
    target = new URL(candidate);
  } catch {
    throw new Error(
      "GENESIS_API_PROXY_TARGET deve ser uma origem HTTP válida.",
    );
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username !== "" ||
    target.password !== "" ||
    target.pathname !== "/" ||
    target.search !== "" ||
    target.hash !== ""
  ) {
    throw new Error(
      "GENESIS_API_PROXY_TARGET deve ser uma origem HTTP(S), sem credenciais, path, query ou fragmento.",
    );
  }
  return target.origin;
}

export default defineConfig(({ mode }) => {
  const serverEnvironment = loadEnv(mode, process.cwd(), "");
  const proxyTarget = parseProxyTarget(
    serverEnvironment.GENESIS_API_PROXY_TARGET,
  );

  return {
    plugins: [react(), tailwindcss(), failClosedApiPlugin(!proxyTarget)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: proxyTarget
        ? {
            "/api/v1": {
              target: proxyTarget,
              changeOrigin: false,
            },
          }
        : undefined,
    },
    test: {
      environment: "jsdom",
      globals: true,
      testTimeout: 10_000,
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      coverage: {
        reporter: ["text", "html"],
      },
    },
  };
});
