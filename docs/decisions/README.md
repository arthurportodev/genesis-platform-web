# Decisões arquiteturais

- `ADR-001-frontend-foundation.md`: stack, organização e limites da fundação.
- `ADR-002-web-session-organization-http.md`: sessão em memória, HTTP,
  coordenação multiaba, Organization ativa, cache e guards.
- `ADR-003-lead-inbox-detail.md`: Inbox, detalhe, timeline, cache tenant,
  concorrência e mutações operacionais de Leads.
- `ADR-004-lead-kanban-pipeline.md`: Pipeline de cinco estágios, queries
  híbridas, paginação por coluna e movimento server-confirmed.
- `ADR-005-lead-follow-up-work-queues.md`: filas operacionais por papel,
  paginação incremental, PII mínima e ações rápidas server-confirmed.
- `ADR-006-lead-operational-metrics.md`: resumo agregado, snapshot versus
  período civil, acesso owner/admin, cache tenant e visualização acessível.
- `ADR-007-manual-lead-creation.md`: formulário completo, respostas por papel,
  idempotência em memória, resultado incerto, PII e invalidações específicas;
  Accepted, incorporado pelo PR #7 no squash
  `4e4f8db0fcd31a4280d72f8cba0a1e0b47f4fa92`.
- `ADR-008-vercel-same-origin-production.md`: Vercel, proxy server-side
  same-origin em `/api/v1`, Preview fail-closed, cookies host-only e fronteira
  com a origem protegida; Accepted, ainda não implementado.
- `ADR-009-development-operating-system-v2-parity.md`: distribuição controlada
  do contrato V2 sob autoridade do backend, dual-read V1/V2, hashes de paridade,
  Skills repo-local, fingerprints e verifier independente.

ADRs são imutáveis depois de substituídas. Uma mudança relevante deve criar uma
nova decisão e apontar qual documento anterior foi superado.
