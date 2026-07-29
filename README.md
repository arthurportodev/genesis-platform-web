# Genesis Platform Web

Frontend oficial da Genesis Platform, construído com React, Vite e TypeScript
estrito. Este repositório contém a fundação visual e operacional da área
administrativa, a integração web de sessão/Organizations/HTTP e a primeira
experiência operacional de CRM: Inbox e detalhe do Lead.

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
proxy, o Vite responde fail-closed nesses paths. O proxy de produção na Vercel
ainda não está configurado e previews não podem acessar a API de produção.

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

## Destinos planejados

- Domínio: `app.agenciagenesis.com.br`.
- Deploy do frontend: Vercel.
- Backend oficial: `arthurportodev/genesis-platform-api`.
- Integração web local: implementada por path same-origin `/api/v1` e proxy
  Vite na tarefa `0.7.1.2`.
- Leads: Inbox, filtros, detalhe, histórico e ações consomem o backend oficial na
  tarefa `0.7.2`; não existe criação de Lead no frontend.

Projeto Vercel, domínio, DNS, proxy de produção e ambientes publicados ainda não
estão configurados.
