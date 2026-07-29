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

O Follow-up usa a sub-raiz tenant-scoped `leads/work` e infinite queries
independentes para Minhas ações, Sem responsável e Retornos para revisão.
Somente a tab e o segmento ativos montam sua query; cursores são `pageParam`
opaco, filtros ficam em memória e páginas são deduplicadas por Lead/revisão sem
recalcular totais. Os adapters projetam modelos especializados sem telefone ou
e-mail antes do Query Cache da fila.

Ações rápidas fazem preflight com detalhe em cache exatamente compatível ou novo
GET e usam somente o ETag opaco retornado pelo backend. Complete, reschedule,
cancel e dismiss preservam intenção e chave contextual em resultado incerto;
assignment não usa chave nem admite replay cego. Sucesso é server-confirmed e
invalida apenas filas, Inbox, Pipeline e recursos do Lead realmente afetados.
`409/412` atualizam o estado e exigem nova confirmação.

Metrics permanece no domínio `features/leads` e consome somente
`GET /api/v1/leads/metrics/summary`. A query usa a sub-raiz tenant-scoped
`leads/metrics`, período canônico default ou range civil, `staleTime` de 30
segundos, refetch por foco quando stale e nenhum polling. `from/to` válidos ficam
na query string; o período default continua omitido e é calculado pelo backend.

A resposta Zod é indivisível e mantém o snapshot atual separado dos eventos do
período. `asOf` e `timeZone` da Organization governam formatação e presets; o
navegador não reclassifica o dia comercial. Owner/admin montam a consulta e
member recebe estado seguro sem request. Perda de papel cancela e remove a
sub-raiz de Metrics. Mutações invalidam essa raiz somente quando alteram os
contadores. A visualização usa cards, lista e barras CSS acessíveis, sem
dependência gráfica ou persistência.

Um estado geral de navegação de Leads registra origem Inbox, Pipeline ou
Follow-up. Tabs, filtros e posição do Follow-up sobrevivem à ida ao detalhe
somente em memória e são descartados em reload, troca de Organization, logout ou
expiração.

## Router

`src/app/router/router.tsx` usa context tipado e `beforeLoad`. Rotas
`/app/**`, inclusive not found aninhado, aguardam a restauração antes do shell.
Anônimo retorna a `/login` com `returnTo` interno validado; múltiplas
Organizations exigem `/select-organization`. Redirects usam replace.

## Limites

NestJS em `arthurportodev/genesis-platform-api` permanece a autoridade de
identidade, tenant e autorização. A matriz de capacidades de Leads é somente UX.
Criação de Lead, estágios customizáveis, calendário, automações, Vercel,
domínio, DNS e deploy não fazem parte desta implementação.
