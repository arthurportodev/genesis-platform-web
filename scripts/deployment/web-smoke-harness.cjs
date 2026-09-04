const { spawnSync } = require('node:child_process');

const LOCAL_BASE_URL = 'http://127.0.0.1:4173';
const PRODUCTION_BASE_URL = 'https://app.agenciagenesismkt.com.br';

function requireCondition(condition, reasonCode) {
  if (!condition) throw new Error(reasonCode);
}

function parseOptionalBoolean(name, value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name}_INVALID`);
}

function parseTargetRoute(value = '/app') {
  requireCondition(typeof value === 'string', 'GENESIS_SMOKE_ROUTE_INVALID');
  let parsed;
  try {
    parsed = new URL(value, 'https://harness.invalid');
  } catch {
    throw new Error('GENESIS_SMOKE_ROUTE_INVALID');
  }
  requireCondition(
    parsed.origin === 'https://harness.invalid' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.pathname === value &&
      (value === '/app' || value.startsWith('/app/')) &&
      !value.includes('\\'),
    'GENESIS_SMOKE_ROUTE_INVALID',
  );
  return value;
}

function readHarnessContract(environment = process.env) {
  const target = environment.GENESIS_HARNESS_TARGET ?? 'production';
  requireCondition(
    target === 'local' || target === 'production',
    'GENESIS_HARNESS_TARGET_INVALID',
  );

  const baseURL =
    environment.GENESIS_HARNESS_BASE_URL ??
    (target === 'local' ? LOCAL_BASE_URL : PRODUCTION_BASE_URL);
  const baseUrlClass =
    baseURL === LOCAL_BASE_URL
      ? 'controlled-local'
      : baseURL === PRODUCTION_BASE_URL
        ? 'production'
        : null;
  requireCondition(
    baseUrlClass !== null,
    'GENESIS_HARNESS_BASE_URL_INVALID',
  );

  return Object.freeze({
    target,
    baseURL,
    baseUrlClass,
    usesLocalFixtures: baseUrlClass === 'controlled-local',
    targetRoute: parseTargetRoute(environment.GENESIS_SMOKE_ROUTE),
    featureSmokeRequired: parseOptionalBoolean(
      'GENESIS_REQUIRE_FEATURE_SMOKE',
      environment.GENESIS_REQUIRE_FEATURE_SMOKE,
    ),
  });
}

function requireFeatureSmokeExecution(contract, executed) {
  if (contract.featureSmokeRequired && !executed) {
    throw new Error('MANDATORY_FEATURE_SMOKE_GATE_UNAVAILABLE');
  }
}

function loadCredentials(contract, environment = process.env) {
  if (contract.usesLocalFixtures) {
    return { email: 'multi@example.test', password: 'correct-horse' };
  }

  const email = environment.GENESIS_SMOKE_EMAIL;
  const password = environment.GENESIS_SMOKE_PASSWORD;
  if (email !== undefined || password !== undefined) {
    requireCondition(
      typeof email === 'string' &&
        email.length > 0 &&
        typeof password === 'string' &&
        password.length > 0,
      'SYNTHETIC_CREDENTIALS_INVALID',
    );
    return { email, password };
  }

  const result = spawnSync(
    'ssh',
    [
      'genesis-vps',
      'sudo',
      '-n',
      'cat',
      '/opt/genesis/secrets/smoke-credentials.json',
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );
  requireCondition(result.status === 0, 'SYNTHETIC_CREDENTIALS_UNAVAILABLE');

  let credentials;
  try {
    credentials = JSON.parse(result.stdout);
  } catch {
    throw new Error('SYNTHETIC_CREDENTIALS_INVALID');
  }
  requireCondition(
    typeof credentials?.email === 'string' &&
      credentials.email.length > 0 &&
      typeof credentials?.password === 'string' &&
      credentials.password.length > 0,
    'SYNTHETIC_CREDENTIALS_INVALID',
  );
  return {
    email: credentials.email,
    password: credentials.password,
  };
}

function currentPath(page) {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return 'unavailable';
  }
}

async function isVisible(locator) {
  return locator.isVisible().catch(() => false);
}

async function loginContractVisible(page) {
  const controls = [
    page.getByRole('heading', { name: 'Acesse sua conta', exact: true }),
    page.getByLabel('E-mail', { exact: true }),
    page.getByLabel('Senha', { exact: true }),
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ];
  return (await Promise.all(controls.map(isVisible))).every(Boolean);
}

async function organizationContractVisible(page) {
  const heading = page.getByRole('heading', {
    name: 'Selecione uma organização',
    exact: true,
  });
  const container = page.locator('[aria-label="Organizações disponíveis"]');
  return (await isVisible(heading)) && (await isVisible(container));
}

async function detectSettledSurface(page, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const pathname = currentPath(page);
    if (pathname === '/login' && (await loginContractVisible(page))) {
      return { pathname, surface: 'login' };
    }
    if (
      pathname === '/select-organization' &&
      (await organizationContractVisible(page))
    ) {
      return { pathname, surface: 'organization-selection' };
    }
    if (
      (pathname === '/app' || pathname.startsWith('/app/')) &&
      (await isVisible(
        page.getByRole('button', {
          name: 'Abrir menu do usuário',
          exact: true,
        }),
      ))
    ) {
      return { pathname, surface: 'app' };
    }
    await page.waitForTimeout(100);
  }
  throw new Error('HARNESS_SURFACE_TIMEOUT');
}

function createDiagnostics(page, contract) {
  const diagnostics = {
    stage: 'initial',
    pageErrors: 0,
    consoleErrorClasses: [],
    httpStatusClasses: {
      success2xx: 0,
      redirect3xx: 0,
      client4xx: 0,
      server5xx: 0,
    },
    sameOriginApi2xx: 0,
    assetFailures: 0,
  };
  const approvedOrigin = new URL(contract.baseURL).origin;

  page.on('pageerror', () => {
    diagnostics.pageErrors += 1;
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    diagnostics.consoleErrorClasses.push(
      /Failed to load resource.*(?:401|Unauthorized)/iu.test(message.text())
        ? 'EXPECTED_ANONYMOUS_HTTP_401_RESOURCE'
        : 'UNCLASSIFIED_CONSOLE_ERROR',
    );
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 500) diagnostics.httpStatusClasses.server5xx += 1;
    else if (status >= 400) diagnostics.httpStatusClasses.client4xx += 1;
    else if (status >= 300) diagnostics.httpStatusClasses.redirect3xx += 1;
    else if (status >= 200) diagnostics.httpStatusClasses.success2xx += 1;

    try {
      const url = new URL(response.url());
      if (
        url.origin === approvedOrigin &&
        (url.pathname === '/api/v1' ||
          url.pathname.startsWith('/api/v1/')) &&
        status >= 200 &&
        status < 300
      ) {
        diagnostics.sameOriginApi2xx += 1;
      }
    } catch {
      // Browser-internal URLs are outside the HTTP contract.
    }
  });
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'script' || request.resourceType() === 'stylesheet') {
      diagnostics.assetFailures += 1;
    }
  });

  return diagnostics;
}

function sanitizedDiagnostics(diagnostics) {
  return {
    stage: diagnostics.stage,
    pageErrors: diagnostics.pageErrors,
    consoleErrorClasses: [...diagnostics.consoleErrorClasses],
    httpStatusClasses: { ...diagnostics.httpStatusClasses },
    sameOriginApi2xx: diagnostics.sameOriginApi2xx,
    assetFailures: diagnostics.assetFailures,
  };
}

function assertCoreDiagnostics(diagnostics) {
  requireCondition(diagnostics.pageErrors === 0, 'FATAL_PAGE_ERROR');
  requireCondition(
    diagnostics.httpStatusClasses.server5xx === 0,
    'HTTP_5XX_OBSERVED',
  );
  requireCondition(diagnostics.assetFailures === 0, 'BROWSER_ASSET_FAILURE');
  requireCondition(
    diagnostics.consoleErrorClasses.every(
      (classification) =>
        classification === 'EXPECTED_ANONYMOUS_HTTP_401_RESOURCE',
    ),
    'UNCLASSIFIED_CONSOLE_ERROR',
  );
  requireCondition(
    diagnostics.sameOriginApi2xx > 0,
    'SAME_ORIGIN_API_NOT_OBSERVED',
  );
}

async function reachProtectedRoute(page, contract, diagnostics) {
  if (contract.usesLocalFixtures) {
    if (diagnostics) diagnostics.stage = 'fixture-reset';
    await page.request.post('/__test/reset');
  }

  if (diagnostics) diagnostics.stage = 'initial-navigation';
  await page.goto(contract.targetRoute, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (diagnostics) diagnostics.stage = 'initial-surface';
  let state = await detectSettledSurface(page);
  const transitions = [];

  for (let transition = 0; transition < 4; transition += 1) {
    transitions.push(state.surface);
    if (state.surface === 'login') {
      if (diagnostics) diagnostics.stage = 'login';
      const credentials = loadCredentials(contract);
      await page.getByLabel('E-mail', { exact: true }).fill(credentials.email);
      await page.getByLabel('Senha', { exact: true }).fill(credentials.password);
      await page
        .getByRole('button', { name: 'Entrar', exact: true })
        .click();
      if (diagnostics) diagnostics.stage = 'login-navigation';
      await page.waitForFunction(
        () => window.location.pathname !== '/login',
        undefined,
        { timeout: 30_000 },
      );
      if (diagnostics) diagnostics.stage = 'post-login-surface';
      state = await detectSettledSurface(page);
      continue;
    }

    if (state.surface === 'organization-selection') {
      if (diagnostics) diagnostics.stage = 'organization-selection';
      const options = page
        .locator('[aria-label="Organizações disponíveis"]')
        .getByRole('button');
      requireCondition(
        (await options.count()) > 0,
        'NO_ORGANIZATION_OPTION_AVAILABLE',
      );
      await options.first().click();
      if (diagnostics) diagnostics.stage = 'organization-navigation';
      await page.waitForFunction(
        () => window.location.pathname !== '/select-organization',
        undefined,
        { timeout: 30_000 },
      );
      if (diagnostics) diagnostics.stage = 'post-organization-surface';
      state = await detectSettledSurface(page);
      continue;
    }

    if (state.surface === 'app') break;
  }

  requireCondition(state.surface === 'app', 'AUTH_ORGANIZATION_NOT_RESOLVED');
  const navigation = page.getByRole('navigation', {
    name: 'Navegação principal',
    exact: true,
  });

  if (state.pathname !== contract.targetRoute) {
    if (diagnostics) diagnostics.stage = 'target-navigation';
    const links = navigation.getByRole('link');
    let targetLink = null;
    for (let index = 0; index < (await links.count()); index += 1) {
      const link = links.nth(index);
      if ((await link.getAttribute('href')) === contract.targetRoute) {
        targetLink = link;
        break;
      }
    }
    if (targetLink) {
      await targetLink.click();
      await page.waitForFunction(
        (targetRoute) => window.location.pathname === targetRoute,
        contract.targetRoute,
        { timeout: 30_000 },
      );
    } else {
      await page.goto(contract.targetRoute, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
    }
  }

  if (diagnostics) diagnostics.stage = 'target-surface';
  state = await detectSettledSurface(page);
  requireCondition(
    state.surface === 'app' && state.pathname === contract.targetRoute,
    'TARGET_ROUTE_NOT_REACHED',
  );

  return { finalPath: state.pathname, transitions };
}

async function logout(page) {
  await page
    .getByRole('button', { name: 'Abrir menu do usuário', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await page.waitForFunction(
    () => window.location.pathname === '/login',
    undefined,
    { timeout: 30_000 },
  );
  const state = await detectSettledSurface(page);
  requireCondition(state.surface === 'login', 'LOGOUT_NOT_CONFIRMED');
}

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name);
  const entry = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return entry?.[1] ?? null;
}

function hasGenesisContent(body) {
  return /genesis|organization|kanban|csrfToken|accessToken|refreshToken/iu.test(
    body,
  );
}

function linkedToGeneratedHost(location, generatedHost) {
  for (const value of location.searchParams.values()) {
    try {
      if (new URL(value).hostname === generatedHost) return true;
    } catch {
      // Non-URL parameters do not establish host binding.
    }
  }
  return false;
}

function classifyGeneratedHostResponse({
  status,
  body,
  headers,
  generatedHost,
}) {
  requireCondition(!hasGenesisContent(body), 'GENERATED_HOST_EXPOSED_GENESIS');

  if (status >= 400 && status < 500) {
    return {
      status,
      classification: 'APPLICATION_FAIL_CLOSED',
      functionalGenesisApiReachable: false,
      credentialsSent: false,
      redirectFollowed: false,
    };
  }

  requireCondition(
    status >= 300 && status < 400,
    'GENERATED_HOST_NOT_FAIL_CLOSED',
  );
  const rawLocation = headerValue(headers, 'location');
  requireCondition(rawLocation, 'VERCEL_PROTECTION_LOCATION_MISSING');
  const location = new URL(rawLocation);
  const cacheControl = headerValue(headers, 'cache-control') ?? '';
  const server = headerValue(headers, 'server') ?? '';
  const setCookie = headerValue(headers, 'set-cookie') ?? '';

  requireCondition(
    location.protocol === 'https:' &&
      location.hostname === 'vercel.com' &&
      location.pathname === '/sso-api',
    'VERCEL_PROTECTION_DESTINATION_INVALID',
  );
  requireCondition(/^Vercel$/iu.test(server), 'VERCEL_LAYER_UNPROVEN');
  requireCondition(
    /(?:^|,)\s*no-store(?:,|$)/iu.test(cacheControl),
    'VERCEL_PROTECTION_CACHE_INVALID',
  );
  requireCondition(
    /(?:^|[,;]\s*)_vercel_sso_nonce=/iu.test(setCookie),
    'VERCEL_PROTECTION_NONCE_MISSING',
  );
  requireCondition(
    linkedToGeneratedHost(location, generatedHost),
    'VERCEL_PROTECTION_HOST_BINDING_MISSING',
  );

  return {
    status,
    classification: 'VERCEL_DEPLOYMENT_PROTECTION',
    functionalGenesisApiReachable: false,
    credentialsSent: false,
    redirectFollowed: false,
  };
}

function safeReasonCode(error) {
  return error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : 'HARNESS_ASSERTION_OR_TIMEOUT';
}

module.exports = {
  LOCAL_BASE_URL,
  PRODUCTION_BASE_URL,
  assertCoreDiagnostics,
  classifyGeneratedHostResponse,
  createDiagnostics,
  detectSettledSurface,
  loginContractVisible,
  logout,
  organizationContractVisible,
  parseTargetRoute,
  reachProtectedRoute,
  readHarnessContract,
  requireFeatureSmokeExecution,
  safeReasonCode,
  sanitizedDiagnostics,
};
