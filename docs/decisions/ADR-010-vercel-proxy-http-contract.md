# ADR-010 — Contrato HTTP do proxy Vercel de produção

- Estado: Accepted provisionally
- Data: 2026-08-13
- Gate: 0.8-MVP-08 Gate 1
- Especializa: ADR-008

## Contexto

O ADR-008 escolheu Vercel e proxy same-origin. A implementação precisa definir
fail-closed, proveniência do IP, preservação HTTP, redirects, cookies e cache de
modo testável sem habilitar produção.

## Decisão

Uma entrypoint Vercel Node.js 24 atende somente `/api/v1` no hostname exato
`app.agenciagenesismkt.com.br`. Ela executa somente em
`VERCEL_ENV=production` e exige o target exato
`https://api.agenciagenesismkt.com.br` e uma chave server-only válida. Preview,
hosts gerados, configuração incompleta e paths fora do namespace respondem
fail-closed sem fetch upstream. Rotas versionadas encaminham o prefixo exato
`/api/v1` e seus descendentes para a única Function `api/proxy.ts`, bloqueiam
explicitamente acesso público ao nome físico `/api/proxy` antes da fase de
filesystem e somente depois executam o fallback da SPA. A Function usa o Web
Handler oficial `export default { fetch(request) { ... } }`; o parâmetro interno
da rota é validado, removido da query pública e nunca encaminhado à API.

A Function aceita somente o único IP canônico do header de plataforma
`x-vercel-forwarded-for`, que a Vercel sobrescreve na borda. Antes do upstream,
remove headers forwarded, `X-Vercel-*`, `X-Genesis-*`, aliases explícitos de
IP/CDN, hop-by-hop fixos e todos os tokens declarados em `Connection`; então
grava server-side a chave de origem
e o IP canônico. O Traefik exige a chave, remove-a e atesta o hop; a API valida
e redige a proveniência antes dos controllers e usa o IP aprovado nos rate
limiters. Um cliente sem a chave não consegue fabricar a cadeia interna.

Método, query, body, status, `Origin`, CSRF, Cookie, ETag, `Retry-After` e
rate-limit headers são preservados. Cada `Set-Cookie` permanece separado e só é
aceito quando `Secure`, `Path=/` e sem `Domain`. `Location` absoluta é reescrita
para path relativo somente quando aponta para o app/API exatos e permanece em
`/api/v1`; destino externo, protocol-relative ou fora do namespace falha
fechado. `HEAD`, `204` e `304` nunca ganham body.

Responses removem headers hop-by-hop fixos/dinâmicos, internos e metadados de
cache. Sucesso e erro sempre definem `Cache-Control`, `CDN-Cache-Control` e
`Vercel-CDN-Cache-Control: no-store`; `Age`, `Surrogate-Control` e
`X-Vercel-Cache` não são propagados. Request/response bodies são limitados a
4,5 MB, upstream possui timeout de 8 segundos e a Function tem duração máxima
versionada de 10 segundos.

## Consequências

- A chave não entra em `VITE_*`, bundle, logs, docs, target ou repositório.
- O target não secreto e a chave só serão configurados em Gate operacional
  posterior; esta decisão não autoriza Vercel, deploy, VPS, DNS ou secrets.
- O plano Hobby atende apenas validação técnica do MVP; antes de uso comercial
  há revisão obrigatória de plano.
- Provas locais cobrem transformação/fail-closed. Garantias da borda e cookies
  reais ainda exigem teste ponta a ponta pós-deploy.

## Alternativas rejeitadas

- Rewrites estáticos sem Function: insuficientes para proveniência, cookies,
  redirects e remoção dinâmica de headers.
- CORS direto navegador→API: cria bypass funcional e amplia a superfície.
- Preview conectado à origem: mistura ambientes e viola fail-closed.
