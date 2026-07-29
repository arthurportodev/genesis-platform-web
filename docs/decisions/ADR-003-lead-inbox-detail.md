# ADR-003 — Inbox e detalhe operacional do Lead

- Estado: Incorporada pelo PR #3, squash
  `859823501bbdee03441a9fa865d823f3890be07a`
- Data: 2026-07-29

## Contexto

A fundação já possuía sessão web, Organization ativa, cliente HTTP, cache
tenant-scoped, ETag e idempotência opt-in. A primeira experiência de CRM precisava
consumir essa infraestrutura e o contrato existente do backend sem criar uma
segunda camada de sessão, inventar endpoints ou antecipar Pipeline e filas.

## Decisão

- `features/leads` contém contratos Zod, adapters, query keys, hooks, matriz de
  capacidades e componentes da Inbox e do detalhe.
- Dependências continuam `app → features/shared` e `features → shared`; providers
  neutros em `shared` expõem HTTP autenticado e o contexto mínimo da Organization.
- Toda query de Lead começa em
  `["organization", organizationId, "leads", ...]` e recebe `AbortSignal`.
- Inbox usa `status=active` por padrão, busca NFC/trim somente entre 3 e 100
  caracteres, filtros em memória e paginação cursor-based com anterior local.
- Histórico consome a ordem ASC do backend e acrescenta páginas sem reversão.
- Diretório de responsáveis consulta apenas memberships ativas e somente para
  owner/admin. A matriz frontend melhora UX, mas o backend permanece autoridade.
- Não há atualização otimista. Após mutação, queries relacionadas são
  invalidadas e relidas.
- PATCH condicional exige `If-Match`. POST operacional usa o novo descritor
  `conditional-idempotent-mutation`, que exige `If-Match` e `Idempotency-Key` e
  preserva a chave no único replay de refresh.
- ETag é opaco e vinculado ao snapshot `{ etag, leadId, revision }`. `409/412`
  preserva rascunho, atualiza o detalhe e nunca reenvia automaticamente.
- PII, busca e rascunhos permanecem somente em memória e não atravessam storage,
  logs, telemetria, URL do navegador ou BroadcastChannel.

## Consequências

A operação pode listar, filtrar, abrir e atuar sobre Leads existentes com
isolamento por Organization e concorrência explícita. O frontend continua sem
criação de Lead, filas globais, métricas ou autorização própria. O Pipeline foi
tratado posteriormente pelo ADR-004, sem reescrever esta decisão.
Vercel, proxy externo, domínio e deploy permanecem tarefas independentes.

## Fontes

- Backend `src/modules/leads/controllers/leads.controller.ts`.
- Backend `src/modules/leads/dto/lead.dto.ts`.
- Backend `src/modules/leads/types/lead-api.type.ts`.
- Backend canônico read-only no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
