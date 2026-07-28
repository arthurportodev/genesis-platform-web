# ADR-002 — Sessão web, Organization ativa e HTTP

- Estado: Aceita
- Data: 2026-07-28

## Contexto

O frontend precisava integrar o contrato web incorporado no backend sem expor o
refresh token, persistir access token ou enfraquecer a reuse detection quando
várias abas compartilham cookies.

## Decisão

- Browser usa exclusivamente base relativa `/api/v1`.
- Vite fornece proxy local por `GENESIS_API_PROXY_TARGET`, variável server-only
  restrita a origem HTTP(S) sem credenciais ou path. Sem target, requests de API
  falham fechadas.
- Proxy Vercel permanece futuro; previews não acessam API nem produção.
- Access token permanece em memória privada, calculando validade por
  `expiresIn` e instante local com margem conservadora.
- Refresh permanece cookie-only `HttpOnly`; CSRF usa cookie legível e header.
- Sessão é máquina discriminada exposta por `useSyncExternalStore`, sem token no
  snapshot React.
- Web Lock `genesis.auth-cookie.v1` serializa rotações. BroadcastChannel
  `genesis.session.v1` compartilha access efêmero, geração e eventos de logout.
- Sem Web Locks, refresh automático é desabilitado; nenhum mutex artesanal é
  usado.
- Bootstrap permanece dentro da sessão como fonte única de user, Organizations,
  membership e papel.
- Somente UUID da Organization ativa usa
  `genesis.activeOrganizationId.v1`; toda preferência é revalidada.
- Query Cache usa prefixos `public`, `account` e
  `organization/organizationId`; troca bloqueia mutation pendente, cancela e
  remove o tenant anterior e invalida o router ao concluir.
- Router usa guards tipados, bloqueia shell durante restauração e valida
  `returnTo`.
- Transporte base não conhece React ou sessão; cliente autenticado recebe token,
  refresh e Organization por injeção em `app/providers`.
- Nenhuma dependência nova é adicionada.

## Consequências

Reload com Web Locks restaura a sessão pelo cookie. Abas evitam refresh
concorrente e adotam a maior geração válida. Browsers sem Web Locks exigem novo
login quando nenhum peer possui token, priorizando segurança. Guards frontend
melhoram UX, mas o backend continua sendo a autoridade de autenticação,
membership, tenant e papel.

Vercel, domínio, DNS, deploy e integração de CRM permanecem tarefas separadas.

## Fontes

- Backend `docs/decisions/ADR-003-authentication-sessions.md`.
- Backend `docs/decisions/ADR-004-active-organization-context.md`.
- Backend `docs/decisions/ADR-010-web-session-contract.md`.
- Backend canônico no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
