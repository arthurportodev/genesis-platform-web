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
- Core smoke: `npm run smoke:production:web`
- Feature smoke command:
- Feature smoke required in Production: `true | false`
- Observation: Web `T+0/T+30/T+120`; API conforme Level do ADR-020

## Authorization

- Production Gate:
- Exact candidate identities:

## Results

- API: `KEEP | ROLLBACK | STOP | N/A`
- Web: `KEEP | ROLLBACK | STOP | N/A`
- Cross-repo closeout: `PASS | STOP | N/A`
