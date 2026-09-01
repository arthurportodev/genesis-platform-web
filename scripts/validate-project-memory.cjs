#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, lstatSync, readFileSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { TextDecoder } = require('node:util');

const POINTER_PATH = 'docs/memory/project-state.pointer.v1.json';
const SCHEMA_PATH =
  'schemas/genesis-harness/project-state.pointer.v1.schema.json';
const BRIDGE_PATH = 'docs/CURRENT_STATE.md';
const BRIDGE_MARKER = '<!-- genesis-memory-bridge:v1 -->';
const HISTORY_MARKER = '<!-- genesis-memory-history:v1 -->';
const HISTORY_MARKER_ALLOWLIST = new Set(['docs/ROADMAP.md']);
const RECEIPT = Object.freeze({
  transitionId: 'MVP-10E-CROSS-REPO',
  targetStateRevision: 'MVP-10D-WEB-INTEGRATED-2026-08-24',
  baseSha: 'ac87eb78640e641c67bf6e354ad497b421d487f8',
  revisionSource: 'containing-commit',
});
const AUTHORITY = Object.freeze({
  repository: 'arthurportodev/genesis-platform-api',
  branch: 'main',
  path: 'docs/memory/project-state.v1.json',
});
const WEB_POINTER = Object.freeze({
  repository: 'arthurportodev/genesis-platform-web',
  path: POINTER_PATH,
  schemaVersion: '1.0.0',
  mode: 'pointer-only',
});
const WEB_RELEASE_REVISION = '017ef0056d97147a5e5337494fa339a3f65986ac';
const RESOLUTION_ORDER = Object.freeze([
  'explicit-checkout',
  'sibling-checkout',
  'remote-read-only',
]);
const MAX_LOCAL_BYTES = 256 * 1024;
const MAX_REMOTE_BYTES = 256 * 1024;
const REMOTE_TIMEOUT_MS = 5000;

const STABLE_SOURCES = Object.freeze([
  'AGENTS.md',
  'README.md',
  'docs/START_HERE.md',
  BRIDGE_PATH,
  'docs/PROJECT_OVERVIEW.md',
  'docs/ROADMAP.md',
  'docs/PRODUCTION.md',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md',
  'docs/DEVELOPMENT_WORKFLOW.md',
  'docs/decisions/README.md',
  'docs/decisions/ADR-008-vercel-same-origin-production.md',
  'docs/decisions/ADR-009-development-operating-system-v2-parity.md',
]);

const FORBIDDEN_POINTER_KEYS = new Set([
  'phase',
  'currentwork',
  'nexttask',
  'operationalstate',
  'blockers',
  'pendinghumandecisions',
  'currentrestrictions',
  'production',
  'productionfacts',
  'productionstate',
  'hostname',
  'hostnames',
  'currenttask',
  'lastcompleted',
  'projectstate',
  'statecopy',
  'facts',
  'documentedat',
  'observedat',
]);
const SECRET_KEY =
  /(?:secret|token|password|authorization|cookie|api[_-]?key)/iu;
const FULL_SHA = /^(?!0{40}$)[a-f0-9]{40}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/u;
const RFC3339_UTC =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/u;
const KNOWN_OPERATIONAL_HOSTNAME =
  /\b(?:app\.agenciagenesis\.com\.br|app\.agenciagenesismkt\.com\.br)\b/iu;

class MemoryError extends Error {
  constructor(code, message, path, nextAction) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    this.path = path;
    this.nextAction = nextAction;
  }
}

function fail(code, message, path, nextAction) {
  throw new MemoryError(code, message, path, nextAction);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, path) {
  if (!isObject(value)) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      `${path} must be an object.`,
      path,
      'Restore the documented pointer object shape.',
    );
  }
}

function assertExactKeys(value, expected, path) {
  assertObject(value, path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      `${path} has an unexpected or missing property.`,
      path,
      `Use exactly these properties: ${wanted.join(', ')}.`,
    );
  }
}

function decodeUtf8(buffer, path) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(
      'MEMORY_PARSE_ERROR',
      `${path} is not strict UTF-8.`,
      path,
      'Encode the file as valid UTF-8 without replacement characters.',
    );
  }
}

function safeReadText(path, maxBytes = MAX_LOCAL_BYTES) {
  let info;
  try {
    info = lstatSync(path);
  } catch (error) {
    fail(
      'MEMORY_UNSAFE_INPUT',
      `Input cannot be inspected: ${error.code ?? 'read failure'}.`,
      path,
      'Provide an existing regular file.',
    );
  }
  if (info.isSymbolicLink() || !info.isFile() || info.size > maxBytes) {
    fail(
      'MEMORY_UNSAFE_INPUT',
      'Input must be a bounded regular file and not a symbolic link.',
      path,
      `Provide a regular file no larger than ${maxBytes} bytes.`,
    );
  }
  return decodeUtf8(readFileSync(path), path);
}

function parseJsonText(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    fail(
      'MEMORY_PARSE_ERROR',
      `${path} is not valid JSON.`,
      path,
      'Fix JSON syntax and preserve strict UTF-8.',
    );
  }
}

function readJson(path) {
  return parseJsonText(safeReadText(path), path);
}

function walkPointer(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkPointer(entry, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) {
    if (typeof value === 'string' && /https?:\/\/[^/\s]*@/iu.test(value)) {
      fail(
        'MEMORY_POINTER_SECRET',
        'Authenticated URLs are forbidden in the pointer.',
        path,
        'Use repository identity and the public read-only resolution contract.',
      );
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_POINTER_KEYS.has(normalized)) {
      fail(
        'MEMORY_POINTER_TEMPORAL_DATA',
        `Temporal or operational field is forbidden: ${key}.`,
        `${path}.${key}`,
        'Keep temporal facts only in the API authority.',
      );
    }
    if (SECRET_KEY.test(key)) {
      fail(
        'MEMORY_POINTER_SECRET',
        `Secret-bearing field is forbidden: ${key}.`,
        `${path}.${key}`,
        'Remove credentials and authorization material from the pointer.',
      );
    }
    walkPointer(entry, `${path}.${key}`);
  }
}

function validateTimestamp(value, path) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (
    typeof value !== 'string' ||
    !RFC3339_UTC.test(value) ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value.slice(0, 10)
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      `${path} must be a real RFC 3339 UTC timestamp.`,
      path,
      'Use an ISO timestamp such as 2026-08-10T12:00:00Z.',
    );
  }
  if (parsed > Date.now() + 5 * 60 * 1000) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      `${path} cannot be materially in the future.`,
      path,
      'Use the candidate generation time.',
    );
  }
}

function validatePointer(pointer) {
  walkPointer(pointer);
  assertExactKeys(
    pointer,
    [
      'schemaVersion',
      'instanceKind',
      'project',
      'mode',
      'authority',
      'receipt',
    ],
    '$',
  );
  const major = Number.parseInt(
    String(pointer.schemaVersion).split('.')[0],
    10,
  );
  if (major !== 1) {
    fail(
      'MEMORY_SCHEMA_UNSUPPORTED',
      'Pointer schema major is not supported.',
      '$.schemaVersion',
      'Use project-state.pointer schema major 1.',
    );
  }
  if (
    pointer.schemaVersion !== '1.0.0' ||
    pointer.instanceKind !== 'current' ||
    pointer.project !== 'genesis-platform' ||
    pointer.mode !== 'pointer-only'
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Pointer identity is invalid.',
      '$',
      'Restore the v1 current pointer identity.',
    );
  }

  assertExactKeys(
    pointer.authority,
    ['repository', 'branch', 'path', 'acceptedSchemaMajor', 'resolutionOrder'],
    '$.authority',
  );
  if (
    pointer.authority.repository !== AUTHORITY.repository ||
    pointer.authority.branch !== AUTHORITY.branch ||
    pointer.authority.path !== AUTHORITY.path ||
    pointer.authority.acceptedSchemaMajor !== 1 ||
    JSON.stringify(pointer.authority.resolutionOrder) !==
      JSON.stringify(RESOLUTION_ORDER)
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Authority locator or resolution order is invalid.',
      '$.authority',
      'Restore the approved API main authority and resolution order.',
    );
  }

  assertExactKeys(
    pointer.receipt,
    [
      'transitionId',
      'targetStateRevision',
      'baseSha',
      'revisionSource',
      'generatedAt',
    ],
    '$.receipt',
  );
  if (
    typeof pointer.receipt.transitionId !== 'string' ||
    !IDENTIFIER.test(pointer.receipt.transitionId) ||
    typeof pointer.receipt.targetStateRevision !== 'string' ||
    !IDENTIFIER.test(pointer.receipt.targetStateRevision)
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Receipt identifiers are malformed.',
      '$.receipt',
      'Use stable non-placeholder transition and state revision IDs.',
    );
  }
  if (
    pointer.receipt.transitionId !== RECEIPT.transitionId ||
    pointer.receipt.targetStateRevision !== RECEIPT.targetStateRevision
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Receipt transition identity or target state revision is invalid.',
      '$.receipt',
      `Use transition ${RECEIPT.transitionId} targeting ${RECEIPT.targetStateRevision}.`,
    );
  }
  if (
    !FULL_SHA.test(pointer.receipt.baseSha) ||
    pointer.receipt.baseSha !== RECEIPT.baseSha
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Receipt baseSha is invalid for this transition.',
      '$.receipt.baseSha',
      `Use the approved Web base ${RECEIPT.baseSha}.`,
    );
  }
  if (pointer.receipt.revisionSource !== RECEIPT.revisionSource) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Receipt provenance must identify its containing commit.',
      '$.receipt.revisionSource',
      'Do not predict or embed the future integrated commit SHA.',
    );
  }
  validateTimestamp(pointer.receipt.generatedAt, '$.receipt.generatedAt');
  return pointer;
}

function validateSchemaPrototype(schema) {
  assertObject(schema, '$schema');
  const expectedRequired = [
    'schemaVersion',
    'instanceKind',
    'project',
    'mode',
    'authority',
    'receipt',
  ];
  const expectedAuthorityRequired = [
    'repository',
    'branch',
    'path',
    'acceptedSchemaMajor',
    'resolutionOrder',
  ];
  const expectedReceiptRequired = [
    'transitionId',
    'targetStateRevision',
    'baseSha',
    'revisionSource',
    'generatedAt',
  ];
  const authority = schema.properties?.authority;
  const receipt = schema.properties?.receipt;
  if (
    schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    schema.$id !==
      'https://github.com/arthurportodev/genesis-platform-web/schemas/genesis-harness/project-state.pointer.v1.schema.json' ||
    schema.type !== 'object' ||
    schema.additionalProperties !== false ||
    JSON.stringify(schema.required) !== JSON.stringify(expectedRequired) ||
    schema.properties?.schemaVersion?.const !== '1.0.0' ||
    schema.properties?.instanceKind?.const !== 'current' ||
    schema.properties?.project?.const !== 'genesis-platform' ||
    schema.properties?.mode?.const !== 'pointer-only' ||
    authority?.type !== 'object' ||
    authority?.additionalProperties !== false ||
    JSON.stringify(authority.required) !==
      JSON.stringify(expectedAuthorityRequired) ||
    authority.properties?.repository?.const !== AUTHORITY.repository ||
    authority.properties?.branch?.const !== AUTHORITY.branch ||
    authority.properties?.path?.const !== AUTHORITY.path ||
    authority.properties?.acceptedSchemaMajor?.const !== 1 ||
    JSON.stringify(authority.properties?.resolutionOrder?.const) !==
      JSON.stringify(RESOLUTION_ORDER) ||
    receipt?.type !== 'object' ||
    receipt?.additionalProperties !== false ||
    JSON.stringify(receipt.required) !==
      JSON.stringify(expectedReceiptRequired) ||
    receipt.properties?.transitionId?.type !== 'string' ||
    receipt.properties?.transitionId?.pattern !==
      '^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$' ||
    receipt.properties?.targetStateRevision?.type !== 'string' ||
    receipt.properties?.targetStateRevision?.pattern !==
      '^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$' ||
    receipt.properties?.baseSha?.type !== 'string' ||
    receipt.properties?.baseSha?.pattern !== '^(?!0{40}$)[a-f0-9]{40}$' ||
    receipt.properties?.revisionSource?.const !== RECEIPT.revisionSource ||
    receipt.properties?.generatedAt?.type !== 'string' ||
    receipt.properties?.generatedAt?.format !== 'date-time'
  ) {
    fail(
      'MEMORY_SCHEMA_INVALID',
      'Pointer schema prototype does not match the focused validator contract.',
      SCHEMA_PATH,
      'Restore the reviewed v1 schema prototype.',
    );
  }
}

function normalizeStableSourcePath(path) {
  return path.replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '');
}

function stableSourceStateNextAction(normalizedPath) {
  if (HISTORY_MARKER_ALLOWLIST.has(normalizedPath)) {
    return 'Move current facts to the canonical API authority or label the entire document histórico/superseded.';
  }
  return 'Remove temporal facts from this source and obtain current facts from the canonical API authority.';
}

function lintStableSource(path, text) {
  const normalizedPath = normalizeStableSourcePath(path);
  if (text.includes(HISTORY_MARKER)) {
    if (!HISTORY_MARKER_ALLOWLIST.has(normalizedPath)) {
      fail(
        'MEMORY_HISTORY_MARKER_NOT_ALLOWED',
        'Historical marker is not allowed in this stable source.',
        normalizedPath,
        `Use the marker only in: ${[...HISTORY_MARKER_ALLOWLIST].join(', ')}.`,
      );
    }
    if (!/^# .*hist[oó]rico\s*\/\s*superseded.*$/imu.test(text)) {
      fail(
        'MEMORY_STABLE_SOURCE_HAS_STATE',
        'Historical marker requires an explicit histórico/superseded label.',
        normalizedPath,
        'Label the entire snapshot as histórico/superseded.',
      );
    }
    return;
  }
  const forbidden = [
    /\b(?:fase|tarefa|estado)\s+atual\b/iu,
    /\bpr[oó]xima\s+tarefa\b/iu,
    /\b0\.8\.(?:2|3|4|5|6|7|8|9|10|11)\b/u,
    /\b(?:Hetzner|Hostinger)\b/iu,
    KNOWN_OPERATIONAL_HOSTNAME,
    /\bcandidato\s+frontend\s+ainda\s+local\b/iu,
    /\bainda\s+n[aã]o\s+(?:est[aá]|foi)\s+(?:implementad[oa]|configurad[oa]|publicad[oa])\b/iu,
  ];
  if (forbidden.some((pattern) => pattern.test(text))) {
    fail(
      'MEMORY_STABLE_SOURCE_HAS_STATE',
      'A stable source contains a current or superseded temporal assertion.',
      normalizedPath,
      stableSourceStateNextAction(normalizedPath),
    );
  }
}

function validateStableSources(root) {
  const bridge = join(root, ...BRIDGE_PATH.split('/'));
  const bridgeText = safeReadText(bridge);
  if (
    !bridgeText.includes(BRIDGE_MARKER) ||
    !bridgeText.includes('AUTHORITY_UNAVAILABLE') ||
    !bridgeText.includes('MEMORY_TRANSITION_PENDING')
  ) {
    fail(
      'MEMORY_BRIDGE_INVALID',
      'CURRENT_STATE is not the stable pointer bridge.',
      BRIDGE_PATH,
      'Restore the v1 bridge marker and explicit unavailable/pending behavior.',
    );
  }
  for (const source of STABLE_SOURCES) {
    const absolute = join(root, ...source.split('/'));
    if (existsSync(absolute)) lintStableSource(source, safeReadText(absolute));
  }
}

function validateLocal(root = process.cwd()) {
  const pointer = validatePointer(
    readJson(join(root, ...POINTER_PATH.split('/'))),
  );
  const schema = readJson(join(root, ...SCHEMA_PATH.split('/')));
  validateSchemaPrototype(schema);
  validateStableSources(root);
  return pointer;
}

function authorityProjectId(authority) {
  return typeof authority.project === 'string'
    ? authority.project
    : authority.project?.id;
}

function validateAuthority(authority, acceptedMajor) {
  assertObject(authority, '$authority');
  const major = Number.parseInt(
    String(authority.schemaVersion).split('.')[0],
    10,
  );
  if (major !== acceptedMajor) {
    fail(
      'MEMORY_SCHEMA_UNSUPPORTED',
      'Authority schema major is incompatible with the pointer.',
      '$authority.schemaVersion',
      `Provide authority schema major ${acceptedMajor}.`,
    );
  }
  if (
    authority.instanceKind !== 'current' ||
    authorityProjectId(authority) !== 'genesis-platform' ||
    authority.authority?.repository !== AUTHORITY.repository ||
    authority.authority?.branch !== AUTHORITY.branch ||
    authority.authority?.path !== AUTHORITY.path ||
    authority.authority?.revisionSource !== 'containing-commit'
  ) {
    fail(
      'MEMORY_AUTHORITY_INVALID',
      'Authority identity or provenance is invalid.',
      '$authority',
      'Use the current Genesis API authority with containing-commit provenance.',
    );
  }
  if (
    typeof authority.stateRevision !== 'string' ||
    !IDENTIFIER.test(authority.stateRevision) ||
    !Array.isArray(authority.repositories)
  ) {
    fail(
      'MEMORY_AUTHORITY_INVALID',
      'Authority revision metadata is incomplete.',
      '$authority',
      'Provide stateRevision and repository memoryRevision metadata.',
    );
  }
  const web = authority.repositories.find(
    (repository) => repository?.id === 'web',
  );
  if (
    !web ||
    web.memoryRevision?.kind !== 'commit' ||
    !FULL_SHA.test(web.memoryRevision?.sha)
  ) {
    fail(
      'MEMORY_AUTHORITY_INVALID',
      'Web memoryRevision is missing or invalid.',
      '$authority.repositories[web].memoryRevision',
      'The API authority must record the exact Web pointer provenance commit.',
    );
  }
  const webIntegratedRevision =
    authority.releaseBindings?.webIntegratedRevision;
  if (
    !FULL_SHA.test(webIntegratedRevision) ||
    webIntegratedRevision !== WEB_RELEASE_REVISION
  ) {
    fail(
      'MEMORY_RELEASE_BINDING_MISMATCH',
      'The Web application/release binding is invalid.',
      '$authority.releaseBindings.webIntegratedRevision',
      `Use the approved historical Web release binding ${WEB_RELEASE_REVISION}.`,
    );
  }
  const pointerMetadata = authority.pointerMetadata;
  if (
    pointerMetadata?.repository !== WEB_POINTER.repository ||
    pointerMetadata?.path !== WEB_POINTER.path ||
    pointerMetadata?.schemaVersion !== WEB_POINTER.schemaVersion ||
    pointerMetadata?.mode !== WEB_POINTER.mode ||
    pointerMetadata?.transitionId !== RECEIPT.transitionId ||
    pointerMetadata?.targetStateRevision !== RECEIPT.targetStateRevision
  ) {
    fail(
      'MEMORY_POINTER_MISMATCH',
      'The API authority does not acknowledge the historical Web receipt.',
      '$authority.pointerMetadata',
      'Restore the exact pointer metadata for the approved Web receipt.',
    );
  }
  return {
    authority,
    webMemoryRevision: web.memoryRevision.sha,
    webIntegratedRevision,
  };
}

async function readRemoteAuthority(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(
      'AUTHORITY_UNAVAILABLE',
      'Authority URL is invalid.',
      '--api-source',
      'Provide an HTTPS URL without credentials.',
    );
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    fail(
      'AUTHORITY_UNAVAILABLE',
      'Remote authority must use unauthenticated HTTPS.',
      '--api-source',
      'Use the public read-only authority URL without credentials.',
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, {
      signal: controller.signal,
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    const length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || length > MAX_REMOTE_BYTES) {
      throw new Error(`HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_REMOTE_BYTES) throw new Error('response too large');
    return decodeUtf8(bytes, parsed.toString());
  } catch (error) {
    fail(
      'AUTHORITY_UNAVAILABLE',
      `Remote authority could not be read: ${error.name ?? 'network error'}.`,
      '--api-source',
      'Retry the bounded public read-only source or use an explicit checkout.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function loadAuthorityText(source) {
  if (/^https?:\/\//iu.test(source)) return readRemoteAuthority(source);
  const absolute = resolve(source);
  let target = absolute;
  try {
    if (statSync(absolute).isDirectory()) {
      target = join(absolute, ...AUTHORITY.path.split('/'));
    }
  } catch {
    fail(
      'AUTHORITY_UNAVAILABLE',
      'Authority source does not exist.',
      '--api-source',
      'Provide the API checkout or the authority JSON path.',
    );
  }
  try {
    return safeReadText(target);
  } catch (error) {
    if (error instanceof MemoryError) {
      fail(
        'AUTHORITY_UNAVAILABLE',
        'Authority source is unavailable or unsafe.',
        '--api-source',
        'Provide a regular authority file from an explicit API checkout.',
      );
    }
    throw error;
  }
}

function containingCommit(root) {
  try {
    const status = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all', '--', POINTER_PATH],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
    if (status !== '') return null;

    const value = execFileSync(
      'git',
      ['log', '-1', '--format=%H', '--', POINTER_PATH],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return FULL_SHA.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeResult(result, diagnostics = []) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  for (const diagnostic of diagnostics) process.stderr.write(`${diagnostic}\n`);
}

function errorResult(error) {
  return {
    ok: false,
    code: error.code,
    codes: [error.code],
    path: error.path,
    nextAction: error.nextAction,
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || value === undefined) {
      throw new MemoryError(
        'USAGE_ERROR',
        'Arguments must be --name value pairs.',
        'argv',
        'Use --mode local or --mode resolve --api-source <path|url>.',
      );
    }
    values.set(name, value);
  }
  const mode = values.get('--mode');
  if (
    (mode !== 'local' && mode !== 'resolve') ||
    (mode === 'resolve' && !values.get('--api-source')) ||
    (mode === 'local' && values.size !== 1) ||
    (mode === 'resolve' && values.size !== 2)
  ) {
    throw new MemoryError(
      'USAGE_ERROR',
      'Unsupported mode or argument set.',
      'argv',
      'Use --mode local or --mode resolve --api-source <path|url>.',
    );
  }
  return { mode, apiSource: values.get('--api-source') };
}

async function main() {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
  } catch (error) {
    writeResult(errorResult(error), [error.message]);
    process.exitCode = 2;
    return;
  }

  let pointer;
  try {
    pointer = validateLocal();
  } catch (error) {
    const failure =
      error instanceof MemoryError
        ? error
        : new MemoryError(
            'MEMORY_PARSE_ERROR',
            'Unexpected local validation failure.',
            POINTER_PATH,
            'Inspect the focused validator inputs.',
          );
    writeResult(errorResult(failure), [failure.message]);
    process.exitCode = 1;
    return;
  }

  if (args.mode === 'local') {
    writeResult({
      ok: true,
      code: 'POINTER_VALID',
      pointerContractValidated: true,
      pointerSemanticRulesValidated: true,
      schemaPrototypeParsed: true,
      stableSourcesValidated: true,
      authorityResolved: false,
    });
    return;
  }

  let authority;
  try {
    const text = await loadAuthorityText(args.apiSource);
    authority = validateAuthority(
      parseJsonText(text, '--api-source'),
      pointer.authority.acceptedSchemaMajor,
    );
  } catch (error) {
    const failure =
      error instanceof MemoryError
        ? error
        : new MemoryError(
            'AUTHORITY_UNAVAILABLE',
            'Authority could not be resolved.',
            '--api-source',
            'Provide an explicit compatible authority source.',
          );
    if (failure.code === 'AUTHORITY_UNAVAILABLE') {
      const codes = ['AUTHORITY_UNAVAILABLE', 'MEMORY_TRANSITION_PENDING'];
      writeResult(
        {
          ok: false,
          code: codes[0],
          codes,
          authorityResolved: false,
          transitionPending: true,
          staleFallbackUsed: false,
          targetStateRevision: pointer.receipt.targetStateRevision,
          nextAction: failure.nextAction,
        },
        [failure.message],
      );
    } else {
      writeResult(errorResult(failure), [failure.message]);
    }
    process.exitCode = 1;
    return;
  }

  const actualMemoryRevision = containingCommit(process.cwd());
  if (actualMemoryRevision === null) {
    writeResult(
      {
        ok: false,
        code: 'MEMORY_TRANSITION_PENDING',
        codes: ['MEMORY_TRANSITION_PENDING'],
        authorityResolved: true,
        transitionPending: true,
        staleFallbackUsed: false,
        targetStateRevision: pointer.receipt.targetStateRevision,
        nextAction:
          'Validate again from a clean commit containing the Web pointer.',
      },
      ['The pointer is not available from a clean containing commit.'],
    );
    process.exitCode = 1;
    return;
  }

  if (authority.webMemoryRevision !== actualMemoryRevision) {
    writeResult(
      {
        ok: false,
        code: 'MEMORY_WEB_REVISION_MISMATCH',
        codes: ['MEMORY_WEB_REVISION_MISMATCH'],
        authorityResolved: true,
        transitionPending: false,
        staleFallbackUsed: false,
        expectedMemoryRevision: authority.webMemoryRevision,
        actualMemoryRevision,
        nextAction:
          'The API authority must record the exact clean commit containing the Web pointer as Web memoryRevision.',
      },
      ['The authority and Web pointer containing commit differ.'],
    );
    process.exitCode = 1;
    return;
  }

  writeResult({
    ok: true,
    code: 'MEMORY_RESOLVED',
    pointerContractValidated: true,
    pointerSemanticRulesValidated: true,
    schemaPrototypeParsed: true,
    stableSourcesValidated: true,
    authorityResolved: true,
    transitionPending: false,
    staleFallbackUsed: false,
    stateRevision: authority.authority.stateRevision,
    webMemoryRevision: actualMemoryRevision,
    webIntegratedRevision: authority.webIntegratedRevision,
    receiptTargetStateRevision: pointer.receipt.targetStateRevision,
  });
}

main().catch((error) => {
  const failure = new MemoryError(
    'AUTHORITY_UNAVAILABLE',
    error.message,
    '--api-source',
    'Retry with an explicit compatible authority source.',
  );
  writeResult(errorResult(failure), [failure.message]);
  process.exitCode = 2;
});
