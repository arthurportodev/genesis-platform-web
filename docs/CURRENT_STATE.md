# Estado atual

Atualizado para o candidato local da tarefa `0.7.5`.

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
- Follow-up com tabs por papel, segmentos atrasadas/hoje/futuras, filas sem
  responsável e retornos administrativos, lazy loading e paginação incremental.
- Modelos especializados das filas descartam telefone e e-mail antes do Query
  Cache; filtros, cursores e contexto de retorno permanecem somente em memória.
- Ações rápidas de Next Action, assignment e dismiss usam detalhe/ETag opaco,
  intenção idempotente contextual quando aplicável, conflitos sem retry,
  tratamento de resultado remoto incerto e invalidação específica.
- Página `/app/metrics` para owner/admin sobre o resumo oficial do backend, com
  snapshot atual, período default/customizado, presets, query string validada,
  timezone da Organization e refresh manual sem polling.
- Métricas mantêm snapshot e eventos do período separados, identificam won/lost
  como ciclos, limitam a taxa de ganho aos ciclos decididos e apresentam origem
  inicial em lista e barras CSS acessíveis, sem biblioteca gráfica.
- Query Cache de Metrics é tenant-scoped, somente em memória e removido na troca
  de Organization, logout ou perda de papel; member não monta a consulta.

## Não disponível

- Criação de Lead, drag-and-drop, estágios customizáveis, calendário,
  automações e comunicação externa.
- Autorização frontend como fronteira de segurança; o backend continua sendo a
  única autoridade.
- Persistência de access, bootstrap ou Query Cache.
- Proxy externo e projeto Vercel, domínio, DNS, staging ou deploy.
- Preview com acesso à API.

A tarefa `0.7.4` foi incorporada pelo PR #5 no squash
`f9fc37dd31fa2116a66354d46938c60d566fe101`. O candidato `0.7.5` ainda não
possui PR, squash SHA, release ou deploy.
