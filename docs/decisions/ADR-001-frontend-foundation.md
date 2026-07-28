# ADR-001 — Fundação frontend

- Estado: Aceita
- Data: 2026-07-28

## Contexto

O frontend precisava de uma base oficial antes da integração com o contrato web
de sessão do backend. A fundação deve permitir evolução incremental sem antecipar
API, identidade, organizações ou dados de negócio.

## Decisões institucionais

- Codex é o implementador oficial do backend e do frontend.
- GitHub é a fonte persistente da verdade.
- Vercel é o destino planejado do frontend, sem projeto ou deploy nesta etapa.
- NestJS no repositório `arthurportodev/genesis-platform-api` continua sendo o
  único backend oficial.
- Lovable é apenas ferramenta opcional de exploração ou referência visual.
- Frontend e backend permanecem em repositórios separados.
- O frontend é uma SPA administrativa em React e Vite. SSR e server functions
  não fazem parte desta fundação.
- A implementação segue o Sistema Operacional de Desenvolvimento da Genesis
  Platform.

## Decisões técnicas

Adotar React, Vite e TypeScript estrito; TanStack Router para rotas baseadas em
código; TanStack Query para futuro estado do servidor; Tailwind e componentes
locais acessíveis; React Hook Form com Zod; Vitest, Testing Library, MSW e
Playwright. Organizar o código em `app`, `features` e `shared` e preparar deep
links de SPA para o destino Vercel.

O bootstrap apresenta indisponibilidade de forma explícita e não faz chamadas
remotas. A API NestJS permanece responsável por domínio, identidade e
autorização. O documento canônico consultado no backend foi
`docs/decisions/ADR-010-web-session-contract.md` no SHA
`8b299a95993bddd3425b5043aaa40fa2eb15edab`.

## Consequências

- A estrutura suporta rotas profundas, responsividade e testes desde o início.
- Autenticação e guards continuam ausentes até a tarefa `0.7.1.2`.
- Dados vazios são estados válidos e não serão preenchidos com fixtures na UI.
- Não existem SSR, server functions ou um segundo backend no frontend.
- Novas dependências e mudanças transversais seguem classe `Critical`.
