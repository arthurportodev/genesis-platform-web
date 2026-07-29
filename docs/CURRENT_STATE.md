# Estado atual

Atualizado para o candidato local da tarefa `0.7.6`.

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
- Página `/app/leads/new` acessível pelo botão `Novo Lead` somente na Inbox,
  com formulário responsivo, validação Zod, proteção de draft e UTMs
  secundárias.
- Criação server-confirmed por `POST /api/v1/leads`, Idempotency-Key UUID v4 sem
  If-Match, owner/admin com responsável opcional e member sem diretório.
- Resultados `201/200` identificados navegam ao detalhe oficial; `204` member é
  opaco e retorna à Inbox. Telefone existente é sucesso de nova entrada, não
  erro de duplicidade.
- Intenção incerta permanece somente em memória e permite confirmar com a mesma
  chave ou abandonar; nenhum payload, draft ou chave entra em storage, URL ou
  caches persistidos.

## Não disponível

- Importação de Lead, formulário público, drag-and-drop, estágios
  customizáveis, calendário, automações e comunicação externa.
- Autorização frontend como fronteira de segurança; o backend continua sendo a
  única autoridade.
- Persistência de access, bootstrap ou Query Cache.
- Proxy externo e projeto Vercel, domínio, DNS, staging ou deploy.
- Preview com acesso à API.

A tarefa `0.7.5` foi incorporada pelo PR #6 no squash
`1ac7e26cda535cbf3e5c02dd78da4e0fb95a2e9e`. O candidato `0.7.6` ainda não
possui PR, squash SHA, release ou deploy.
