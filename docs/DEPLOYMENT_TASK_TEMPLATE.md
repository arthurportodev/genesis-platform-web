# Template curto de deployment

Preencha somente os fatos variáveis. O procedimento está no
[runbook](DEPLOYMENT_RUNBOOK.md); não o copie para o Task Packet.

## Release

- Feature/task:
- Surfaces: `API_ONLY | WEB_ONLY | API_AND_WEB`

## API — quando aplicável

- Application SHA:
- Operational SHA:
- Candidate digest:
- Migration level: `1 | 2 | 3`
- Expected pending:
- Previous image factual:

## Web — quando aplicável

- Source SHA:
- Candidate deployment:
- Previous deployment:

## Validation

- CI run(s):
- Production Health:
  - deployment `READY`:
  - candidate/source correto:
  - custom domain correto:
  - Web HTTP 200:
  - API health HTTP 200:
- Manual Product Acceptance: `APPROVE | REJECT | PENDING`
- Risk-based automated validation required: `true | false`
- Risk and command, when required:
- Long observation required: `true | false`
- Checkpoints and reason, when required; API segue o Level do ADR-020:

## Authorization

- Production Gate:
- Exact candidate identities:

## Results

- API: `KEEP | ROLLBACK | STOP | N/A`
- Web: `KEEP | ROLLBACK | STOP | N/A`
- Cross-repo closeout: `PASS | STOP | N/A`
