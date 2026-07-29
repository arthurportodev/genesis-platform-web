# Estado atual

Atualizado para o candidato local da tarefa `0.7.3`.

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
- Inbox real de Leads com busca protegida, filtros, ordenação, paginação por
  cursor, tabela desktop e cards mobile.
- Detalhe do Lead, próxima ação, ciclos e histórico incremental em ordem
  cronológica.
- Atualização, atribuição, notas, atividades, próxima ação e ciclo comercial com
  ETag/If-Match e Idempotency-Key conforme o contrato backend.
- Diretório de responsáveis somente para owner/admin; capacidade frontend é
  apenas UX e nunca substitui autorização do backend.
- Pipeline com cinco estágios canônicos, carga inicial agregada, filtros em
  memória e paginação independente por coluna.
- Cards com PII minimizada, layout horizontal no desktop, uma etapa por vez no
  mobile e filtros em Sheet.
- Movimento server-confirmed sem drag-and-drop: detalhe/ETag opaco como
  preflight, If-Match, Idempotency-Key vinculada à revisão, conflitos sem retry
  automático e releitura completa do quadro.

## Não disponível

- Criação de Lead, drag-and-drop, estágios customizáveis, filas globais, página
  de Follow-up e métricas.
- Autorização frontend por papel; o backend continua sendo a única autoridade.
- Persistência de access, bootstrap ou Query Cache.
- Proxy externo e projeto Vercel, domínio, DNS, staging ou deploy.
- Preview com acesso à API.

O candidato `0.7.3` ainda não possui PR, squash SHA, release ou deploy. A tarefa
`0.7.2` foi incorporada pelo PR #3 no squash
`859823501bbdee03441a9fa865d823f3890be07a`.
