#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, lstatSync, readFileSync } = require('node:fs');
const { dirname, join, relative, resolve, sep } = require('node:path');
const { TextDecoder } = require('node:util');

const POINTER_PATH = 'docs/memory/project-state.pointer.v2.json';
const SCHEMA_PATH =
  'schemas/genesis-harness/project-state.pointer.v2.schema.json';
const BRIDGE_PATH = 'docs/CURRENT_STATE.md';
const BRIDGE_MARKER = '<!-- genesis-memory-bridge:v2 -->';
const AUTHORITY = Object.freeze({
  repository: 'arthurportodev/genesis-platform-api',
  branch: 'main',
  path: 'docs/memory/project-state.v2.json',
  acceptedSchemaMajor: 2,
});
const RESOLUTION_ORDER = Object.freeze([
  'explicit-checkout',
  'sibling-checkout',
  'remote-read-only',
]);
const MAX_BYTES = 64 * 1024;
const REMOTE_TIMEOUT_MS = 5000;
const FULL_SHA = /^(?!0{40}$)[a-f0-9]{40}$/u;
const SEMVER = /^(?<major>0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/u;
const IMAGE = /^ghcr\.io\/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/u;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{20,80}$/u;
const SECRET_KEY =
  /(?:password|passwd|token|cookie|authorization|secret|private[_-]?key|credential|client[_-]?secret)/iu;
const SECRET_VALUE =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:gh[opurs]|github_pat)_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{12,}|Basic\s+[A-Za-z0-9+/=]{12,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,})/u;
const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'stateRevision',
  'phase',
  'lastCompleted',
  'currentWork',
  'nextTask',
  'live',
  'openBlockers',
  'activeRestrictions',
  'followUps',
]);

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

function exactKeys(value, keys, path) {
  if (!isObject(value)) {
    fail(
      'SCHEMA_INVALID',
      `${path} must be an object.`,
      path,
      'Fix the JSON shape.',
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      'SCHEMA_INVALID',
      `${path} has missing or unexpected properties.`,
      path,
      `Use exactly: ${expected.join(', ')}.`,
    );
  }
}

function decode(bytes, path) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail(
      'MEMORY_PARSE_ERROR',
      `${path} is not valid UTF-8.`,
      path,
      'Use UTF-8 JSON.',
    );
  }
}

function safeRead(path) {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES) {
      throw new Error('unsafe file');
    }
    return decode(readFileSync(path), path);
  } catch (error) {
    if (error instanceof MemoryError) throw error;
    fail(
      'AUTHORITY_UNAVAILABLE',
      `Cannot read a bounded regular file at ${path}.`,
      path,
      'Provide the expected checkout or authority JSON file.',
    );
  }
}

function parseJson(text, path) {
  try {
    return JSON.parse(text);
  } catch {
    fail(
      'MEMORY_PARSE_ERROR',
      `${path} is not valid JSON.`,
      path,
      'Fix the JSON syntax.',
    );
  }
}

function scanSecrets(value, path = '$') {
  if (typeof value === 'string') {
    if (SECRET_VALUE.test(value)) {
      fail(
        'SECRET_MATERIAL',
        `Credential-like value at ${path}.`,
        path,
        'Remove credential material.',
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    if (SECRET_KEY.test(key)) {
      fail(
        'SECRET_MATERIAL',
        `Secret-bearing key at ${itemPath}.`,
        itemPath,
        'Remove secret-bearing fields.',
      );
    }
    scanSecrets(item, itemPath);
  }
}

function validatePointer(pointer) {
  scanSecrets(pointer);
  exactKeys(pointer, ['schemaVersion', 'authority'], '$');
  if (pointer.schemaVersion !== '2.0.0') {
    fail(
      'UNSUPPORTED_SCHEMA_MAJOR',
      'Pointer schema major is unsupported.',
      '$.schemaVersion',
      'Use pointer schema 2.0.0.',
    );
  }
  exactKeys(
    pointer.authority,
    ['repository', 'branch', 'path', 'acceptedSchemaMajor', 'resolutionOrder'],
    '$.authority',
  );
  const authority = pointer.authority;
  if (
    authority.repository !== AUTHORITY.repository ||
    authority.branch !== AUTHORITY.branch ||
    authority.path !== AUTHORITY.path ||
    authority.acceptedSchemaMajor !== AUTHORITY.acceptedSchemaMajor ||
    JSON.stringify(authority.resolutionOrder) !==
      JSON.stringify(RESOLUTION_ORDER)
  ) {
    fail(
      'POINTER_CONTRACT_INVALID',
      'Pointer authority contract is invalid.',
      '$.authority',
      'Restore the static v2 authority coordinates and resolution order.',
    );
  }
  return pointer;
}

function validatePointerSchema(schema) {
  exactKeys(
    schema,
    [
      '$schema',
      '$id',
      'title',
      'type',
      'additionalProperties',
      'required',
      'properties',
    ],
    '$schema',
  );
  const authority = schema.properties?.authority;
  exactKeys(
    schema.properties,
    ['schemaVersion', 'authority'],
    '$schema.properties',
  );
  exactKeys(
    authority,
    ['type', 'additionalProperties', 'required', 'properties'],
    '$schema.properties.authority',
  );
  exactKeys(
    authority.properties,
    ['repository', 'branch', 'path', 'acceptedSchemaMajor', 'resolutionOrder'],
    '$schema.properties.authority.properties',
  );
  if (
    schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    schema.type !== 'object' ||
    schema.additionalProperties !== false ||
    JSON.stringify(schema.required) !==
      JSON.stringify(['schemaVersion', 'authority']) ||
    schema.properties?.schemaVersion?.const !== '2.0.0' ||
    authority?.type !== 'object' ||
    authority?.additionalProperties !== false ||
    JSON.stringify(authority.required) !==
      JSON.stringify([
        'repository',
        'branch',
        'path',
        'acceptedSchemaMajor',
        'resolutionOrder',
      ]) ||
    authority.properties?.repository?.const !== AUTHORITY.repository ||
    authority.properties?.branch?.const !== AUTHORITY.branch ||
    authority.properties?.path?.const !== AUTHORITY.path ||
    authority.properties?.acceptedSchemaMajor?.const !==
      AUTHORITY.acceptedSchemaMajor ||
    JSON.stringify(authority.properties?.resolutionOrder?.const) !==
      JSON.stringify(RESOLUTION_ORDER)
  ) {
    fail(
      'POINTER_SCHEMA_INVALID',
      'Pointer schema does not encode the closed v2 contract.',
      SCHEMA_PATH,
      'Restore the strict static pointer schema.',
    );
  }
}

function validateNamed(value, path) {
  exactKeys(value, ['id', 'title'], path);
  if (
    !IDENTIFIER.test(value.id) ||
    typeof value.title !== 'string' ||
    value.title.length < 1 ||
    value.title.length > 160
  ) {
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      `${path} is invalid.`,
      path,
      'Use a valid identifier and title.',
    );
  }
}

function validateNotes(items, path, ids) {
  if (!Array.isArray(items))
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      `${path} must be an array.`,
      path,
      'Use an array.',
    );
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    exactKeys(item, ['id', 'summary'], itemPath);
    if (
      !IDENTIFIER.test(item.id) ||
      typeof item.summary !== 'string' ||
      item.summary.length < 1 ||
      item.summary.length > 500
    ) {
      fail(
        'AUTHORITY_SCHEMA_INVALID',
        `${itemPath} is invalid.`,
        itemPath,
        'Use a valid id and concise summary.',
      );
    }
    if (ids.has(item.id))
      fail(
        'DUPLICATE_ID',
        `Duplicate id ${item.id}.`,
        itemPath,
        'Use unique blocker, restriction and follow-up ids.',
      );
    ids.add(item.id);
  }
}

function validateAuthority(
  state,
  acceptedMajor = AUTHORITY.acceptedSchemaMajor,
) {
  scanSecrets(state);
  exactKeys(state, TOP_LEVEL_KEYS, '$authority');
  const version = SEMVER.exec(state.schemaVersion);
  if (!version || Number(version.groups.major) !== acceptedMajor) {
    fail(
      'UNSUPPORTED_SCHEMA_MAJOR',
      'Authority schema major is unsupported.',
      '$authority.schemaVersion',
      `Use schema major ${acceptedMajor}.`,
    );
  }
  if (!IDENTIFIER.test(state.stateRevision))
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      'stateRevision is invalid.',
      '$authority.stateRevision',
      'Use a stable semantic identifier.',
    );
  validateNamed(state.phase, '$authority.phase');
  exactKeys(
    state.lastCompleted,
    ['id', 'title', 'outcome'],
    '$authority.lastCompleted',
  );
  if (
    !IDENTIFIER.test(state.lastCompleted.id) ||
    typeof state.lastCompleted.title !== 'string' ||
    state.lastCompleted.title.length < 1 ||
    state.lastCompleted.title.length > 160 ||
    typeof state.lastCompleted.outcome !== 'string' ||
    state.lastCompleted.outcome.length < 1 ||
    state.lastCompleted.outcome.length > 500
  ) {
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      'lastCompleted is invalid.',
      '$authority.lastCompleted',
      'Provide id, title and outcome.',
    );
  }
  if (state.currentWork?.status === 'none')
    exactKeys(state.currentWork, ['status'], '$authority.currentWork');
  else if (state.currentWork?.status === 'active') {
    exactKeys(
      state.currentWork,
      ['status', 'id', 'title'],
      '$authority.currentWork',
    );
    validateNamed(
      { id: state.currentWork.id, title: state.currentWork.title },
      '$authority.currentWork',
    );
  } else
    fail(
      'STATE_CONTRADICTION',
      'currentWork status is invalid.',
      '$authority.currentWork',
      'Use none or active with its exact shape.',
    );
  if (state.nextTask?.status === 'undecided') {
    exactKeys(
      state.nextTask,
      ['status', 'planningState'],
      '$authority.nextTask',
    );
    if (!IDENTIFIER.test(state.nextTask.planningState))
      fail(
        'AUTHORITY_SCHEMA_INVALID',
        'planningState is invalid.',
        '$authority.nextTask.planningState',
        'Use an identifier.',
      );
  } else if (state.nextTask?.status === 'decided') {
    exactKeys(state.nextTask, ['status', 'id', 'title'], '$authority.nextTask');
    validateNamed(
      { id: state.nextTask.id, title: state.nextTask.title },
      '$authority.nextTask',
    );
  } else
    fail(
      'STATE_CONTRADICTION',
      'nextTask status is invalid.',
      '$authority.nextTask',
      'Use undecided or decided with its exact shape.',
    );
  exactKeys(state.live, ['api', 'web'], '$authority.live');
  exactKeys(state.live.api, ['sourceSha', 'image'], '$authority.live.api');
  exactKeys(
    state.live.web,
    ['sourceSha', 'deploymentId', 'domain'],
    '$authority.live.web',
  );
  if (
    !FULL_SHA.test(state.live.api.sourceSha) ||
    !IMAGE.test(state.live.api.image) ||
    !FULL_SHA.test(state.live.web.sourceSha) ||
    !DEPLOYMENT.test(state.live.web.deploymentId)
  ) {
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      'Live bindings are invalid.',
      '$authority.live',
      'Provide complete immutable API and Web bindings.',
    );
  }
  let domain;
  try {
    domain = new URL(state.live.web.domain);
  } catch {
    domain = null;
  }
  if (
    !domain ||
    domain.protocol !== 'https:' ||
    domain.username ||
    domain.password ||
    domain.pathname !== '/' ||
    domain.search ||
    domain.hash
  ) {
    fail(
      'AUTHORITY_SCHEMA_INVALID',
      'Web domain must be a credential-free HTTPS origin.',
      '$authority.live.web.domain',
      'Use an HTTPS origin.',
    );
  }
  const ids = new Set();
  validateNotes(state.openBlockers, '$authority.openBlockers', ids);
  validateNotes(state.activeRestrictions, '$authority.activeRestrictions', ids);
  validateNotes(state.followUps, '$authority.followUps', ids);
  return state;
}

function validateLocal(root = process.cwd()) {
  const pointer = validatePointer(
    parseJson(safeRead(join(root, POINTER_PATH)), POINTER_PATH),
  );
  validatePointerSchema(
    parseJson(safeRead(join(root, SCHEMA_PATH)), SCHEMA_PATH),
  );
  const bridge = safeRead(join(root, BRIDGE_PATH));
  for (const marker of [
    BRIDGE_MARKER,
    POINTER_PATH,
    AUTHORITY.path,
    'AUTHORITY_UNAVAILABLE',
    'EXPECTED_AUTHORITY_SHA_MISMATCH',
  ]) {
    if (!bridge.includes(marker))
      fail(
        'BRIDGE_INVALID',
        `Bridge is missing ${marker}.`,
        BRIDGE_PATH,
        'Restore the static v2 bridge contract.',
      );
  }
  if (
    /project-state(?:\.pointer)?\.v1|MEMORY_TRANSITION_PENDING/u.test(bridge)
  ) {
    fail(
      'BRIDGE_INVALID',
      'Bridge still describes the v1 receipt protocol.',
      BRIDGE_PATH,
      'Remove v1 transition semantics.',
    );
  }
  return pointer;
}

function gitOutput(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function verifyLocalPin(sourcePath, expectedSha) {
  if (!FULL_SHA.test(expectedSha))
    fail(
      'EXPECTED_AUTHORITY_SHA_MISMATCH',
      'Expected authority SHA is malformed.',
      '--expected-authority-sha',
      'Supply a lowercase full Git SHA.',
    );
  const root = gitOutput(dirname(sourcePath), ['rev-parse', '--show-toplevel']);
  if (!root || gitOutput(root, ['rev-parse', 'HEAD']) !== expectedSha) {
    fail(
      'EXPECTED_AUTHORITY_SHA_MISMATCH',
      'Checkout HEAD does not match the expected authority SHA.',
      sourcePath,
      'Use the exact pinned API checkout.',
    );
  }
  const rel = relative(root, sourcePath).split(sep).join('/');
  if (rel !== AUTHORITY.path)
    fail(
      'EXPECTED_AUTHORITY_SHA_MISMATCH',
      'Pinned source is not the canonical authority path.',
      sourcePath,
      `Use ${AUTHORITY.path}.`,
    );
  let committed;
  try {
    committed = execFileSync(
      'git',
      ['-C', root, 'show', `${expectedSha}:${AUTHORITY.path}`],
      { maxBuffer: MAX_BYTES, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    fail(
      'EXPECTED_AUTHORITY_SHA_MISMATCH',
      'Pinned commit does not contain the authority.',
      sourcePath,
      'Use an integrated API v2 authority SHA.',
    );
  }
  if (!readFileSync(sourcePath).equals(committed))
    fail(
      'EXPECTED_AUTHORITY_SHA_MISMATCH',
      'Working authority differs from the pinned commit.',
      sourcePath,
      'Restore the exact committed authority.',
    );
  return expectedSha;
}

async function defaultRemoteRead(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (
    !parsed ||
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password
  ) {
    fail(
      'AUTHORITY_UNAVAILABLE',
      'Remote source must be credential-free HTTPS.',
      url,
      'Use the approved read-only authority URL.',
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
    if (!response.ok || length > MAX_BYTES)
      throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('response too large');
    return decode(bytes, parsed.toString());
  } catch (error) {
    if (error instanceof MemoryError) throw error;
    fail(
      'AUTHORITY_UNAVAILABLE',
      `Remote authority could not be read: ${error.name ?? 'network error'}.`,
      url,
      'Retry or provide an explicit checkout.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveAuthority(pointer, options = {}, dependencies = {}) {
  const cwd = options.cwd ?? process.cwd();
  const exists = dependencies.exists ?? existsSync;
  const readLocal = dependencies.readLocal ?? safeRead;
  const readRemote = dependencies.readRemote ?? defaultRemoteRead;
  const verifyPin = dependencies.verifyPin ?? verifyLocalPin;
  const explicit = options.apiSource;
  let strategy;
  let source;
  let isRemote = false;
  if (explicit) {
    isRemote = /^https?:\/\//iu.test(explicit);
    strategy = isRemote ? 'remote-read-only' : 'explicit-checkout';
    source = explicit;
  } else {
    const sibling = resolve(cwd, '..', 'genesis-platform-api');
    if (exists(sibling)) {
      strategy = 'sibling-checkout';
      source = sibling;
    } else {
      strategy = 'remote-read-only';
      source = `https://raw.githubusercontent.com/${pointer.authority.repository}/${pointer.authority.branch}/${pointer.authority.path}`;
      isRemote = true;
    }
  }
  let text;
  let authoritySha = null;
  if (isRemote) {
    let parsedSource;
    try {
      parsedSource = new URL(source);
    } catch {
      parsedSource = null;
    }
    if (
      !parsedSource ||
      parsedSource.protocol !== 'https:' ||
      parsedSource.username ||
      parsedSource.password
    ) {
      fail(
        'AUTHORITY_UNAVAILABLE',
        'Remote source must be credential-free HTTPS.',
        String(source),
        'Use the approved read-only authority URL.',
      );
    }
    if (options.expectedAuthoritySha) {
      if (
        !FULL_SHA.test(options.expectedAuthoritySha) ||
        !parsedSource.pathname.includes(`/${options.expectedAuthoritySha}/`)
      ) {
        fail(
          'EXPECTED_AUTHORITY_SHA_MISMATCH',
          'Remote URL does not bind the expected authority SHA.',
          source,
          'Use a raw URL containing the exact API commit SHA.',
        );
      }
      authoritySha = options.expectedAuthoritySha;
    }
    text = await readRemote(source);
  } else {
    const absolute = resolve(source);
    const sourcePath =
      exists(absolute) && lstatSync(absolute).isDirectory()
        ? join(absolute, ...pointer.authority.path.split('/'))
        : absolute;
    if (!exists(sourcePath))
      fail(
        'AUTHORITY_UNAVAILABLE',
        'Selected authority source is unavailable.',
        sourcePath,
        'Provide the API checkout or authority JSON path.',
      );
    if (options.expectedAuthoritySha)
      authoritySha = verifyPin(sourcePath, options.expectedAuthoritySha);
    text = readLocal(sourcePath);
    source = sourcePath;
  }
  const state = validateAuthority(
    parseJson(text, String(source)),
    pointer.authority.acceptedSchemaMajor,
  );
  return { state, strategy, source: String(source), authoritySha };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (
      !['--mode', '--api-source', '--expected-authority-sha'].includes(name) ||
      options[name] !== undefined
    ) {
      fail(
        'USAGE_ERROR',
        `Unexpected argument: ${name}.`,
        'argv',
        'Use --mode local|resolve with optional resolve inputs.',
      );
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--'))
      fail(
        'USAGE_ERROR',
        `${name} requires a value.`,
        'argv',
        'Supply every argument value.',
      );
    options[name] = value;
    index += 1;
  }
  const mode = options['--mode'];
  if (
    !['local', 'resolve'].includes(mode) ||
    (mode === 'local' && Object.keys(options).length !== 1)
  ) {
    fail(
      'USAGE_ERROR',
      'Unsupported argument combination.',
      'argv',
      'Use --mode local, or --mode resolve with optional source and expected SHA.',
    );
  }
  return {
    mode,
    apiSource: options['--api-source'],
    expectedAuthoritySha: options['--expected-authority-sha'],
  };
}

function writeResult(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const pointer = validateLocal();
    if (args.mode === 'local') {
      writeResult({
        ok: true,
        code: 'POINTER_VALID',
        pointerStatic: true,
        authorityResolved: false,
      });
      return;
    }
    const resolved = await resolveAuthority(pointer, args);
    writeResult({
      ok: true,
      code: 'MEMORY_RESOLVED',
      authorityResolved: true,
      staleFallbackUsed: false,
      resolutionStrategy: resolved.strategy,
      authoritySha: resolved.authoritySha,
      schemaVersion: resolved.state.schemaVersion,
      stateRevision: resolved.state.stateRevision,
    });
  } catch (error) {
    const failure =
      error instanceof MemoryError
        ? error
        : new MemoryError(
            'AUTHORITY_UNAVAILABLE',
            'Authority resolution failed.',
            'runtime',
            'Inspect the selected source.',
          );
    writeResult({
      ok: false,
      code: failure.code,
      authorityResolved: false,
      staleFallbackUsed: false,
      path: failure.path,
      nextAction: failure.nextAction,
    });
    process.stderr.write(`${failure.message}\n`);
    process.exitCode = failure.code === 'USAGE_ERROR' ? 2 : 1;
  }
}

if (require.main === module) main();

module.exports = {
  AUTHORITY,
  BRIDGE_MARKER,
  BRIDGE_PATH,
  MemoryError,
  POINTER_PATH,
  RESOLUTION_ORDER,
  SCHEMA_PATH,
  parseArguments,
  resolveAuthority,
  safeRead,
  validateAuthority,
  validateLocal,
  validatePointer,
  validatePointerSchema,
  verifyLocalPin,
};
