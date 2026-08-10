# Genesis Platform Web

Frontend oficial da Genesis Platform, construído com React, Vite e TypeScript
estrito. Este repositório contém a fundação visual e operacional da área
administrativa, a integração web de sessão/Organizations/HTTP e a primeira
experiência operacional de CRM: Inbox, detalhe, Pipeline Kanban, filas de
Follow-up, métricas operacionais e criação manual de Leads.

## Requisitos

- Node.js 24
- npm 11 ou superior

## Desenvolvimento local

```bash
npm ci
npm run dev
```

Copie `.env.example` para `.env.local` e ajuste
`GENESIS_API_PROXY_TARGET` para o backend local. Essa variável é lida somente
pelo servidor Vite e nunca entra no bundle. O backend local deve usar
`FRONTEND_URL=http://localhost:5173`. Nunca versione arquivos `.env` reais.

O navegador chama exclusivamente paths relativos `/api/v1`. Sem target de
proxy, o Vite responde fail-closed nesses paths. Previews não podem acessar a
API de produção; o contrato de publicação mantém proxy same-origin e falha
fechada.

## Validação

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Para tarefas governadas, crie o manifesto local a partir de
`.codex/task-manifest.example.json` e use `npm run task:preflight`,
`npm run task:validate` e `npm run task:fingerprint`.

Leia [docs/START_HERE.md](docs/START_HERE.md) antes de contribuir.
Para fatos temporais, resolva o
[pointer da memória canônica](docs/memory/project-state.pointer.v1.json). O
[contrato de produção do frontend](docs/PRODUCTION.md) preserva a arquitetura
Vercel aprovada e os gates estáveis, sem duplicar status operacional.

## Destinos arquiteturais

- Hospedagem do frontend: Vercel.
- Hostname operacional: deve ser obtido da autoridade canônica indicada pelo
  contrato de memória; não é uma constante deste README.
- Backend oficial: `arthurportodev/genesis-platform-api`.
- Integração web local: implementada por path same-origin `/api/v1` e proxy
  Vite na tarefa `0.7.1.2`.
- Leads: Inbox, filtros, detalhe, histórico e ações consomem o backend oficial na
  tarefa `0.7.2`.
- Pipeline: cinco estágios canônicos, paginação independente e movimento
  server-confirmed com ETag/If-Match e Idempotency-Key na tarefa `0.7.3`.
- Follow-up: ações atrasadas, de hoje e futuras, Leads sem responsável e
  retornos para revisão, com paginação incremental e ações rápidas
  server-confirmed na tarefa `0.7.4`.
- Métricas: snapshot atual, desempenho por período e origem dos Leads, com
  timezone da Organization e acesso exclusivo de owner/admin na tarefa `0.7.5`.
- Criação manual: página `/app/leads/new`, contrato server-confirmed,
  idempotência somente em memória e resultados identificados para owner/admin
  ou opacos para member, incorporada na tarefa `0.7.6` pelo PR #7, squash
  `4e4f8db0fcd31a4280d72f8cba0a1e0b47f4fa92`.
- Não existe drag-and-drop ou estágios customizáveis no frontend.

Status de publicação, domínio, DNS, proxy e autorização de dados reais são
consultados exclusivamente na memória canônica da API. Este README não é uma
fonte de fase, trabalho ou prontidão operacional.
