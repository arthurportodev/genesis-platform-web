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

ADRs são imutáveis depois de substituídas. Uma mudança relevante deve criar uma
nova decisão e apontar qual documento anterior foi superado.
