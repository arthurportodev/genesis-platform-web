# Segurança

## Sessão web implementada

- Access token curto permanece somente em memória privada do coordenador.
- Refresh trafega exclusivamente no cookie `HttpOnly` do backend e nunca é
  lido, persistido ou enviado em body/header/query pelo frontend.
- Cookies CSRF reconhecidos possuem fonte única e são validados como base64url;
  duplicidade ou divergência body/cookie falha fechada.
- Login, refresh, logout e logout-all usam `X-CSRF-Token`, com uma única
  renovação após `403`. O frontend nunca define `Origin`.
- Web Locks serializam emissão de CSRF e rotação de refresh. Timeout não permite
  operação concorrente.
- BroadcastChannel valida versão, UUIDs, geração e payload. Access trafega apenas
  de modo efêmero same-origin; geração antiga é rejeitada.
- Sem Web Locks, nenhum refresh automático ocorre, preservando reuse detection.

## Tenant e navegação

- Bootstrap autenticado é a fonte única de user, Organizations, membership e
  role; nenhum desses dados é derivado do JWT.
- Somente `genesis.activeOrganizationId.v1`, contendo UUID, pode ser persistido.
- A preferência nunca concede autorização e sempre é confrontada com bootstrap.
- Cache autenticado é segmentado e removido em troca, logout ou expiração.
- `returnTo` aceita somente `/app` e `/app/**`, sem URL absoluta, esquema,
  host, barra invertida ou controle.
- Shell e not found administrativo permanecem protegidos sem flash.

## HTTP e dados

- Browser chama apenas paths relativos canonicalizados dentro de `/api/v1` com
  credentials; segmentos que escapariam do namespace são rejeitados.
- Resposta HTML ou content type inesperado em API é erro de protocolo.
- Bodies de resposta possuem limite defensivo e `429` impõe cooldown local sem
  presumir `Retry-After`.
- Nenhum componente/página executa fetch diretamente.
- Nenhum token, senha, cookie, bootstrap completo ou PII é registrado.
- ETag permanece opaco; If-Match e Idempotency-Key são enviados somente quando
  solicitados pela feature.

## Ambientes

`GENESIS_API_PROXY_TARGET` é server-only no Vite e rejeita credenciais, paths,
queries, fragmentos e protocolos diferentes de HTTP(S). Variáveis `VITE_*` são
públicas e não podem conter segredos. Previews permanecem sem acesso à API e
nunca apontam para produção. Proxy Vercel, domínio e deploy não estão
configurados.

## Fronteira de autorização

O backend NestJS continua validando sessão, Organization, membership e papel em
cada request. Guards e menus frontend são apenas experiência de navegação e não
substituem autorização.
