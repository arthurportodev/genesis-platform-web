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
tenant-scoped. ETag, If-Match e Idempotency-Key são opt-in.

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

## Router

`src/app/router/router.tsx` usa context tipado e `beforeLoad`. Rotas
`/app/**`, inclusive not found aninhado, aguardam a restauração antes do shell.
Anônimo retorna a `/login` com `returnTo` interno validado; múltiplas
Organizations exigem `/select-organization`. Redirects usam replace.

## Limites

NestJS em `arthurportodev/genesis-platform-api` permanece a autoridade de
identidade, tenant e autorização. Guards frontend são somente UX. CRM real,
Vercel, domínio, DNS e deploy não fazem parte desta implementação.
