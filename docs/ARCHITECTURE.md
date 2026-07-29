# Arquitetura

## Camadas

- `src/app`: composição de runtime, providers, QueryClient e router.
- `src/features`: autenticação, sessão, Organizations e páginas de produto.
- `src/shared`: transporte HTTP, taxonomia de erros, configuração pública,
  utilitários e componentes sem dependência de features.
- `src/test` e `test/e2e`: MSW, infraestrutura compartilhada e navegador real.

Dependências seguem `app → features/shared` e `features → shared`.
`shared` não depende de `app` ou `features`; `features` não depende de
`app`. O transporte base recebe apenas descritores, enquanto o cliente
autenticado recebe token, refresh e Organization por injeção na composição de
`app/providers`.

## Sessão

O coordenador mantém access token e geração em closure privada. O snapshot React
expõe somente status discriminado, user seguro, Organizations, Organization
ativa e operações. Login, refresh, logout e logout-all usam CSRF cookie-to-header;
refresh nunca é lido pelo JavaScript.

A inicialização pede token válido aos peers, usa Web Lock
`genesis.auth-cookie.v1` antes de qualquer refresh e publica access efêmero no
BroadcastChannel `genesis.session.v1`. Sem Web Locks, refresh automático fica
desabilitado; login e logout explícitos permanecem disponíveis. Não existe
refresh periódico.

## HTTP

O navegador usa somente `/api/v1/*`, `credentials: include`, parsing JSON
estrito, timeout combinado com o AbortSignal do caller e taxonomia segura de
erros. Paths são canonicalizados dentro de `/api/v1`, bodies são limitados e
HTML em path de API é erro de protocolo. `429` ativa cooldown local. Bearer é lido imediatamente
antes do dispatch; `X-Organization-Id` aparece somente em requests
tenant-scoped. ETag, If-Match e Idempotency-Key são opt-in. O descritor
`conditional-idempotent-mutation` exige os dois headers, rejeita `If-Match: *` e
mantém a mesma chave em um único replay após refresh.

No desenvolvimento, o Vite lê `GENESIS_API_PROXY_TARGET` sem prefixo
`VITE_` e aceita somente origem HTTP(S) sem credenciais ou path. Ausência do target responde fail-closed. Vercel conserva apenas o
fallback SPA: external rewrite de produção não foi implementado.

## Organization e cache

Bootstrap é a fonte única de user, memberships, roles e Organizations. Somente o
UUID validado da preferência ativa usa `localStorage`. Query keys seguem:

- `["public", resource, ...]`;
- `["account", resource, ...]`;
- `["organization", organizationId, resource, ...]`.

Troca de Organization bloqueia novo contexto tenant, recusa a troca enquanto
há mutation não cancelável, cancela queries antigas, remove o cache anterior,
ativa e persiste o novo UUID e então invalida o router.

## Leads

`features/leads` concentra contratos Zod, adapters HTTP, query keys, queries,
mutations, capacidades puras e componentes. O cliente HTTP e os dados mínimos da
Organization são injetados por providers em `shared`, mantendo
`app → features/shared`, `features → shared` e `shared` independente.

Todas as chaves começam em
`["organization", organizationId, "leads", ...]`. Inbox e detalhe usam
`staleTime` de 15 segundos; timeline 10 segundos; próxima ação zero; ciclos 30
segundos; responsáveis 60 segundos. Não há polling nem atualização otimista.
Troca de Organization e logout reutilizam a limpeza tenant existente.

A Inbox mantém busca e filtros somente em memória, pagina por cursor com pilha
local e converte datas finais inclusivas em limites exclusivos por aritmética de
calendário. O histórico preserva a ordem ASC do backend e acrescenta páginas sem
reordenar. Um snapshot `{ etag, leadId, revision }` impede usar uma versão em
outro Lead; o ETag continua opaco. Em `409/412`, o rascunho é preservado, os
dados são relidos e não existe reenvio automático.

O Pipeline usa uma query agregada para as cinco colunas e uma infinite query
independente por estágio para continuações. Filtros e cursores ficam somente em
memória; todo fetch recebe AbortSignal. Páginas são deduplicadas por `id`, maior
`revision` e `asOf`, sem recalcular totais do backend. O movimento é
server-confirmed: usa ETag de detalhe exatamente compatível ou faz novo GET,
envia If-Match e Idempotency-Key vinculada à revisão de origem e relê o Kanban
completo após sucesso. Não há drag-and-drop, polling ou atualização otimista.

## Router

`src/app/router/router.tsx` usa context tipado e `beforeLoad`. Rotas
`/app/**`, inclusive not found aninhado, aguardam a restauração antes do shell.
Anônimo retorna a `/login` com `returnTo` interno validado; múltiplas
Organizations exigem `/select-organization`. Redirects usam replace.

## Limites

NestJS em `arthurportodev/genesis-platform-api` permanece a autoridade de
identidade, tenant e autorização. A matriz de capacidades de Leads é somente UX.
Criação de Lead, estágios customizáveis, filas globais, métricas, Vercel,
domínio, DNS e deploy não fazem parte desta implementação.
