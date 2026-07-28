# Genesis Platform Web

Frontend oficial da Genesis Platform, construído com React, Vite e TypeScript
estrito. Este repositório contém a fundação visual e operacional da área
administrativa; autenticação, sessão, organizações e dados de negócio ainda não
estão integrados.

## Requisitos

- Node.js 24
- npm 11 ou superior

## Desenvolvimento local

```bash
npm ci
npm run dev
```

Copie `.env.example` para `.env.local` apenas quando precisar sobrescrever
configurações públicas de build. Nunca versione arquivos `.env` reais.

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
- Integração com a API: tarefa `0.7.1.2`, preferencialmente por path
  same-origin/proxy da Vercel e sujeita ao Gate 1 dessa tarefa.

Projeto Vercel, domínio, DNS, proxy, API e ambientes publicados ainda não estão
configurados.
