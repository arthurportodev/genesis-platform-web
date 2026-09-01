const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const {
  ContractValidationError,
  SHARED_CONTRACT_FILES,
  SKILLS,
  UPSTREAM_COMMIT_SHA,
  candidateIdFor,
  validateEvidenceManifest,
  validateFinding,
  validateHandoff,
  validateRepositoryContracts,
  validateSchemaInstance,
  validateVerifierEvidence,
} = require('../../scripts/task-contracts.cjs');

const HASH = 'a'.repeat(64);
const SHA = 'b'.repeat(40);

function contractFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'genesis-web-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of [
    ...SHARED_CONTRACT_FILES,
    '.codex/task-manifest.example.json',
    'schemas/development-operations/contract-set.json',
  ]) {
    const target = join(root, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(process.cwd(), ...path.split('/')), target);
  }
  return root;
}

function finding(overrides = {}) {
  return {
    schemaVersion: 'finding.v1',
    id: 'F-001',
    severity: 'low',
    category: 'correctness',
    decisionRequired: false,
    autonomousFixAllowed: false,
    evidence: [{ claim: 'fixture' }],
    expectedInvariant: 'approved invariant',
    remediation: 'restore the invariant',
    validation: ['specific regression'],
    status: 'open',
    relatedFiles: ['docs/value.md'],
    fingerprintBinding: {
      baseSha: SHA,
      contentFingerprint: HASH,
      candidateId: HASH,
    },
    ...overrides,
  };
}

test('requires the complete autonomy envelope for High corrections', () => {
  assert.throws(
    () =>
      validateFinding(
        finding({ severity: 'high', autonomousFixAllowed: true }),
      ),
    ContractValidationError,
  );
  const valid = finding({
    severity: 'high',
    autonomousFixAllowed: true,
    scopeStatus: 'within-authorized-scope',
    autonomyEvidence: {
      approvedInvariant: true,
      dominantFix: true,
      local: true,
      reversible: true,
      objectivelyVerifiable: true,
      specificRegressionTest: true,
      focusedValidation: true,
      criticalFinalValidation: true,
      independentReverification: true,
      materialDecision: false,
      forbiddenBoundaryChange: false,
    },
  });
  assert.equal(validateFinding(valid), valid);
});

test('blocks autonomous Critical findings', () => {
  assert.throws(
    () =>
      validateFinding(
        finding({ severity: 'critical', autonomousFixAllowed: true }),
      ),
    /Critical finding/u,
  );
});

test('allows proportional Low and Medium autonomy without the High envelope', () => {
  for (const severity of ['low', 'medium']) {
    const value = finding({
      severity,
      autonomousFixAllowed: true,
      scopeStatus: 'within-authorized-scope',
    });
    assert.equal(validateFinding(value), value);
  }
});

test('binds resolved High findings to a new independently verified candidate', () => {
  const before = {
    baseSha: SHA,
    contentFingerprint: '1'.repeat(64),
    candidateId: '2'.repeat(64),
  };
  const after = {
    baseSha: SHA,
    contentFingerprint: '3'.repeat(64),
    candidateId: '4'.repeat(64),
  };
  const resolved = finding({
    severity: 'high',
    status: 'resolved',
    fingerprintBinding: after,
    resolution: {
      summary: 'restored invariant',
      regressionTest: 'specific regression',
      validationRuns: ['focused', 'critical'],
      independentVerifierRunId: 'verify-2',
      beforeFingerprintBinding: before,
      afterFingerprintBinding: after,
    },
  });
  assert.equal(validateFinding(resolved), resolved);
  assert.throws(
    () =>
      validateFinding({
        ...resolved,
        resolution: {
          ...resolved.resolution,
          afterFingerprintBinding: before,
        },
      }),
    /new content fingerprint/u,
  );
});

test('requires objective unchanged-candidate evidence for Critical reclassification', () => {
  const reclassified = finding({
    severity: 'critical',
    status: 'reclassified',
    reclassification: {
      from: 'critical',
      to: 'high',
      reason: 'objective false positive',
      verifierRunId: 'verify-3',
      objectiveEvidence: 'the invariant is not present in this candidate',
      candidateUnchanged: true,
      materialDecision: false,
      architectureChange: false,
      securityChange: false,
      contractChange: false,
      baseSha: SHA,
      contentFingerprint: HASH,
      candidateId: HASH,
    },
  });
  assert.equal(validateFinding(reclassified), reclassified);
  assert.throws(
    () =>
      validateFinding({
        ...reclassified,
        reclassification: {
          ...reclassified.reclassification,
          candidateId: 'c'.repeat(64),
        },
      }),
    /bind to the unchanged finding candidate/u,
  );
});

test('requires verifier independence, read-only state and stable fingerprints', () => {
  const evidence = {
    schemaVersion: 'verifier-evidence.v1',
    verifierRunId: 'verify-1',
    taskId: '0.8.1.1',
    executorId: 'verifier',
    builderExecutorId: 'builder',
    implementedCandidate: false,
    readOnly: true,
    readOnlyEvidence: {
      beforeStatusHash: HASH,
      afterStatusHash: HASH,
      writeOperations: 0,
    },
    baseSha: SHA,
    candidateId: candidateIdFor({
      taskId: '0.8.1.1',
      baseSha: SHA,
      contentFingerprint: HASH,
    }),
    contentFingerprintBefore: HASH,
    contentFingerprintAfter: HASH,
    gitStateFingerprintBefore: HASH,
    gitStateFingerprintAfter: HASH,
    candidatePaths: ['docs/value.md'],
    reviewedFiles: ['docs/value.md'],
    sourcesConsulted: [
      { source: 'docs/value.md', mode: 'direct', reason: 'candidate' },
    ],
    coverage: { candidatePathsReviewed: 1, limitations: [] },
    findings: [],
    recommendation: 'approve',
  };
  assert.equal(
    validateVerifierEvidence(evidence, {
      expectedCandidatePaths: evidence.candidatePaths,
    }),
    evidence,
  );
  assert.throws(
    () =>
      validateVerifierEvidence({
        ...evidence,
        executorId: 'builder',
      }),
    /must differ/u,
  );
  assert.throws(
    () =>
      validateVerifierEvidence(
        {
          ...evidence,
          coverage: { candidatePathsReviewed: 99, limitations: [] },
        },
        { expectedCandidatePaths: evidence.candidatePaths },
      ),
    /coverage count/u,
  );
  assert.throws(
    () =>
      validateVerifierEvidence(
        {
          ...evidence,
          coverage: {
            candidatePathsReviewed: 1,
            limitations: ['partial review'],
          },
        },
        { expectedCandidatePaths: evidence.candidatePaths },
      ),
    /approval cannot contain coverage limitations/u,
  );
  assert.throws(
    () =>
      validateVerifierEvidence(
        {
          ...evidence,
          findings: [
            finding({
              severity: 'critical',
              fingerprintBinding: {
                baseSha: SHA,
                contentFingerprint: HASH,
                candidateId: evidence.candidateId,
              },
            }),
          ],
        },
        { expectedCandidatePaths: evidence.candidatePaths },
      ),
    /approval cannot contain pending findings/u,
  );
  assert.throws(
    () =>
      validateVerifierEvidence({
        ...evidence,
        findings: [finding()],
        recommendation: 'block',
      }),
    /not bound to the verifier candidate/u,
  );
  for (const recommendation of ['approve', 'conditional', 'block']) {
    assert.throws(
      () =>
        validateVerifierEvidence(
          { ...evidence, recommendation },
          { expectedCandidatePaths: ['docs/different.md'] },
        ),
      /do not match the current candidate/u,
    );
  }
});

test('validates compact handoff and dry-run Evidence Manifest invariants', () => {
  const handoff = {
    schemaVersion: 'handoff.v1',
    task: '0.8.1.1',
    contract: 'Task Packet',
    class: 'critical',
    baseSha: SHA,
    files: [],
    fingerprints: {
      contentFingerprint: HASH,
      gitStateFingerprint: HASH,
      candidateId: HASH,
    },
    validations: [],
    initialFindings: [],
    corrections: [],
    finalFindings: [],
    deviations: [],
    residualRisks: [],
    gitPerformed: [],
    gitNotPerformed: [],
    recommendation: 'approve-gate-2',
  };
  assert.equal(validateHandoff(handoff), handoff);
  assert.throws(
    () =>
      validateHandoff({
        ...handoff,
        fingerprints: {
          contentFingerprint: null,
          gitStateFingerprint: 1,
          candidateId: {},
        },
      }),
    /invalid type/u,
  );

  const dryRun = {
    schemaVersion: 'evidence-manifest.v1',
    mode: 'dry-run',
    taskId: 'future',
    repository: 'repo',
    commitSha: SHA,
    imageDigest: null,
    configHash: null,
    resourcesChanged: [],
    initialState: { version: 1 },
    finalState: { version: 1 },
    migration: null,
    backup: null,
    restoreTest: null,
    health: {},
    readiness: {},
    smoke: {},
    rollbackTarget: null,
    findings: [],
    residualRisks: [],
    operator: { id: 'operator', authorizationEnvelope: 'gate' },
    occurredAt: '2026-07-30T12:00:00Z',
    provenance: {},
    manifestHash: HASH,
  };
  assert.equal(validateEvidenceManifest(dryRun), dryRun);
});

test('rejects schema-incompatible instances for every structured contract', () => {
  const invalidFinding = finding({ extra: true });
  delete invalidFinding.category;
  assert.throws(() => validateFinding(invalidFinding), /category is required/u);

  const verifier = {
    schemaVersion: 'verifier-evidence.v1',
    verifierRunId: 'verify-1',
    taskId: '0.8.1.1',
    executorId: 'verifier',
    builderExecutorId: 'builder',
    implementedCandidate: false,
    readOnly: true,
    readOnlyEvidence: {
      beforeStatusHash: HASH,
      afterStatusHash: HASH,
      writeOperations: 0,
    },
    baseSha: SHA,
    candidateId: candidateIdFor({
      taskId: '0.8.1.1',
      baseSha: SHA,
      contentFingerprint: HASH,
    }),
    contentFingerprintBefore: HASH,
    contentFingerprintAfter: HASH,
    gitStateFingerprintBefore: HASH,
    gitStateFingerprintAfter: HASH,
    candidatePaths: ['docs/value.md'],
    reviewedFiles: ['docs/value.md'],
    sourcesConsulted: [
      { source: 'docs/value.md', mode: 'direct', reason: 'candidate' },
    ],
    coverage: { candidatePathsReviewed: 'all', limitations: [] },
    findings: [],
    recommendation: 'ship',
  };
  assert.throws(() => validateVerifierEvidence(verifier), /invalid type/u);

  assert.throws(
    () =>
      validateHandoff({
        schemaVersion: 'handoff.v1',
        task: '0.8.1.1',
        contract: 'Task Packet',
        class: 'urgent',
        baseSha: SHA,
        files: [1],
        fingerprints: {
          contentFingerprint: HASH,
          gitStateFingerprint: HASH,
          candidateId: HASH,
        },
        validations: [],
        initialFindings: [],
        corrections: [],
        finalFindings: [],
        deviations: [],
        residualRisks: [],
        gitPerformed: [],
        gitNotPerformed: [],
        recommendation: 'approve-gate-2',
      }),
    ContractValidationError,
  );

  assert.throws(
    () =>
      validateEvidenceManifest({
        schemaVersion: 'evidence-manifest.v1',
        mode: 'dry-run',
        taskId: 'future',
        repository: 'repo',
        commitSha: SHA,
      }),
    /imageDigest is required/u,
  );

  const taskManifest = JSON.parse(
    readFileSync('.codex/task-manifest.example.json', 'utf8'),
  );
  assert.equal(
    validateSchemaInstance('task-manifest.v2.schema.json', taskManifest),
    taskManifest,
  );
  assert.throws(
    () =>
      validateSchemaInstance('task-manifest.v2.schema.json', {
        ...taskManifest,
        unexpected: true,
      }),
    /unexpected is not allowed/u,
  );
});

test('validates the canonical repository contract set', () => {
  const result = validateRepositoryContracts({ cwd: process.cwd() });
  assert.equal(result.status, 'passed');
  assert.equal(result.schemas, 5);
  assert.equal(result.skills, 3);
  assert.equal(result.upstreamCommitSha, UPSTREAM_COMMIT_SHA);
  assert.deepEqual(SKILLS, [
    'genesis-task-orchestrator',
    'genesis-frontend-product-engineer',
    'genesis-independent-verifier',
  ]);
});

test('binds the frontend Skill projection to the exact API authority', () => {
  const contract = JSON.parse(
    readFileSync('schemas/development-operations/contract-set.json', 'utf8'),
  );
  assert.equal(
    contract.authorityRepository,
    'arthurportodev/genesis-platform-api',
  );
  assert.equal(contract.upstream.repository, contract.authorityRepository);
  assert.equal(contract.upstream.commitSha, UPSTREAM_COMMIT_SHA);
  assert.deepEqual(
    contract.files
      .filter((entry) =>
        entry.path.startsWith(
          '.agents/skills/genesis-frontend-product-engineer/',
        ),
      )
      .map((entry) => entry.path),
    [
      '.agents/skills/genesis-frontend-product-engineer/SKILL.md',
      '.agents/skills/genesis-frontend-product-engineer/agents/openai.yaml',
    ],
  );
});

test('rejects a missing or divergent frontend Skill projection', (t) => {
  const missing = contractFixture(t);
  unlinkSync(
    join(
      missing,
      '.agents',
      'skills',
      'genesis-frontend-product-engineer',
      'SKILL.md',
    ),
  );
  assert.throws(
    () => validateRepositoryContracts({ cwd: missing }),
    /could not be read|could not be validated/u,
  );

  const divergent = contractFixture(t);
  writeFileSync(
    join(
      divergent,
      '.agents',
      'skills',
      'genesis-frontend-product-engineer',
      'agents',
      'openai.yaml',
    ),
    'drift\n',
  );
  assert.throws(
    () => validateRepositoryContracts({ cwd: divergent }),
    /contract hash mismatch/u,
  );
});

test('rejects a contract set bound to another API upstream', (t) => {
  const root = contractFixture(t);
  const path = join(
    root,
    'schemas',
    'development-operations',
    'contract-set.json',
  );
  const contract = JSON.parse(readFileSync(path, 'utf8'));
  contract.upstream.commitSha = '0'.repeat(40);
  writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`);
  assert.throws(
    () => validateRepositoryContracts({ cwd: root }),
    /upstream identity mismatch/u,
  );
});
