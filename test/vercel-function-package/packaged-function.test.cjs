const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, relative, resolve, sep } = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const repositoryRoot = resolve(__dirname, "../..");

function filesBelow(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current)) {
    const absolute = join(current, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...filesBelow(root, absolute));
    } else {
      files.push(relative(root, absolute).split(sep).join("/"));
    }
  }
  return files;
}

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("the packaged Vercel Function is a closed, resolvable Node ESM bundle", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "genesis-vercel-function-"));
  const bundle = join(workspace, "bundle");
  const config = join(workspace, "tsconfig.json");
  const tsc = join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");

  try {
    writeFileSync(
      config,
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "NodeNext",
            moduleResolution: "NodeNext",
            rootDir: repositoryRoot,
            outDir: bundle,
            types: ["node"],
            typeRoots: [join(repositoryRoot, "node_modules", "@types")],
            strict: true,
            skipLibCheck: true,
            noEmitOnError: true,
            sourceMap: false,
            declaration: false,
          },
          files: [
            join(repositoryRoot, "api", "proxy.ts"),
            join(repositoryRoot, "src", "server", "api-proxy.ts"),
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const compilation = spawnSync(process.execPath, [tsc, "-p", config], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    assert.equal(
      compilation.status,
      0,
      `${compilation.stdout}\n${compilation.stderr}`,
    );

    writeFileSync(
      join(bundle, "package.json"),
      '{"private":true,"type":"module"}\n',
      "utf8",
    );
    const entrypoint = join(bundle, "api", "proxy.js");
    const proxyModule = join(bundle, "src", "server", "api-proxy.js");
    const transportModule = join(
      bundle,
      "src",
      "shared",
      "api",
      "if-match-transport.js",
    );
    assert.equal(existsSync(entrypoint), true);
    assert.equal(existsSync(proxyModule), true);
    assert.equal(existsSync(transportModule), true);
    assert.deepEqual(filesBelow(bundle).sort(), [
      "api/proxy.js",
      "package.json",
      "src/server/api-proxy.js",
      "src/shared/api/if-match-transport.js",
    ]);

    const entrypointSource = readFileSync(entrypoint, "utf8");
    assert.match(
      entrypointSource,
      /from\s+["']\.\.\/src\/server\/api-proxy\.js["']/u,
    );
    for (const match of entrypointSource.matchAll(
      /(?:from\s+|import\s*)["'](\.[^"']+)["']/gu,
    )) {
      assert.equal(
        existsSync(resolve(dirname(entrypoint), match[1])),
        true,
        `unresolved packaged import: ${match[1]}`,
      );
    }

    const packaged = await import(
      `${pathToFileURL(entrypoint).href}?test=${Date.now()}`
    );
    assert.equal(typeof packaged.default?.fetch, "function");

    const previousVercelEnvironment = process.env.VERCEL_ENV;
    const previousTarget = process.env.GENESIS_API_PROXY_TARGET;
    const previousOriginKey = process.env.GENESIS_ORIGIN_KEY;
    const originalFetch = globalThis.fetch;
    let upstreamContacts = 0;
    process.env.VERCEL_ENV = "preview";
    delete process.env.GENESIS_API_PROXY_TARGET;
    delete process.env.GENESIS_ORIGIN_KEY;
    globalThis.fetch = async () => {
      upstreamContacts += 1;
      throw new Error("Preview attempted upstream contact");
    };

    try {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        const response = await packaged.default.fetch(
          new Request(
            "https://candidate.vercel.app/api/v1/auth/bootstrap?__genesis_proxy_path=auth%2Fbootstrap&synthetic=1",
            { method },
          ),
        );
        assert.equal(response.status, 404);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("cdn-cache-control"), "no-store");
        assert.equal(
          response.headers.get("vercel-cdn-cache-control"),
          "no-store",
        );
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal(response.headers.get("location"), null);
        assert.equal(response.headers.get("x-vercel-cache"), null);
        if (method === "GET") {
          assert.deepEqual(await response.json(), {
            statusCode: 404,
            message: "API integration unavailable.",
          });
        }
      }
      assert.equal(upstreamContacts, 0);

      process.env.VERCEL_ENV = "production";
      process.env.GENESIS_API_PROXY_TARGET =
        "https://api.agenciagenesismkt.com.br";
      const syntheticOriginKey = "S".repeat(43);
      process.env.GENESIS_ORIGIN_KEY = syntheticOriginKey;
      globalThis.fetch = async (input, init) => {
        upstreamContacts += 1;
        assert.equal(
          input.href,
          "https://api.agenciagenesismkt.com.br/api/v1/auth/csrf?synthetic=1",
        );
        assert.equal(init.method, "GET");
        assert.equal(
          init.headers.get("origin"),
          "https://app.agenciagenesismkt.com.br",
        );
        assert.equal(
          init.headers.get("x-genesis-origin-key"),
          syntheticOriginKey,
        );
        assert.equal(init.headers.get("host"), null);
        assert.equal(init.headers.get("x-forwarded-host"), null);
        assert.equal(init.headers.get("x-forwarded-proto"), null);
        assert.equal(init.headers.get("x-vercel-deployment-url"), null);
        return new Response(null, { status: 204 });
      };

      const emittedLogs = [];
      const originalConsole = {
        error: console.error,
        info: console.info,
        log: console.log,
        warn: console.warn,
      };
      let productionResponse;
      try {
        for (const method of Object.keys(originalConsole)) {
          console[method] = (...values) => emittedLogs.push(values);
        }
        productionResponse = await packaged.default.fetch(
          new Request(
            "https://genesis-platform-c2.vercel.app/api/v1/auth/csrf?__genesis_proxy_path=auth%2Fcsrf&synthetic=1",
            {
              headers: {
                host: "app.agenciagenesismkt.com.br",
                origin: "https://app.agenciagenesismkt.com.br",
                "x-forwarded-host": "app.agenciagenesismkt.com.br",
                "x-forwarded-proto": "https",
                "x-vercel-deployment-url": "genesis-platform-c2.vercel.app",
                "x-vercel-forwarded-for": "203.0.113.9",
              },
            },
          ),
        );
      } finally {
        Object.assign(console, originalConsole);
      }
      assert.equal(productionResponse.status, 204);
      assert.equal(productionResponse.headers.get("cache-control"), "no-store");
      assert.equal(await productionResponse.text(), "");
      assert.equal(
        JSON.stringify(emittedLogs).includes(syntheticOriginKey),
        false,
      );
      assert.equal(upstreamContacts, 1);
    } finally {
      globalThis.fetch = originalFetch;
      restoreEnvironment("VERCEL_ENV", previousVercelEnvironment);
      restoreEnvironment("GENESIS_API_PROXY_TARGET", previousTarget);
      restoreEnvironment("GENESIS_ORIGIN_KEY", previousOriginKey);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
