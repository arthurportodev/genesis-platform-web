# Estado atual

Atualizado para o candidato local da tarefa `0.7.1.2`.

## Disponível

- React/Vite/TypeScript estrito, shell administrativo e design system inicial.
- Cliente HTTP centralizado sobre `fetch`, paths `/api/v1`, timeout/abort e
  erros tipados.
- Login real, access somente em memória, refresh cookie-only e CSRF.
- Restauração, Web Locks, BroadcastChannel, single-flight e fallback seguro.
- Bootstrap, zero/uma/várias Organizations, preferência UUID e troca atômica.
- Guards reais, `returnTo` seguro, logout e logout-all.
- Query keys tenant-scoped, limpeza de cache, ETag e idempotência opt-in.
- Vitest/MSW, concorrência e Playwright Chromium com stub HTTP same-origin.
- Proxy Vite local por `GENESIS_API_PROXY_TARGET`, fail-closed sem target.

## Não disponível

- Endpoints e dados reais de Leads, Pipeline, Activities, Notes ou métricas.
- Autorização frontend por papel; o backend continua sendo a única autoridade.
- Persistência de access, bootstrap ou Query Cache.
- Proxy externo e projeto Vercel, domínio, DNS, staging ou deploy.
- Preview com acesso à API.

O candidato ainda não possui PR, squash SHA, release ou deploy. Essas operações
dependem dos Gates posteriores.
