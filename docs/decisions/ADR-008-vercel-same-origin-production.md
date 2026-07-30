# ADR-008 — Vercel e proxy same-origin na primeira produção

- Estado: Accepted
- Data: 2026-07-30

## Contexto

O frontend já usa paths relativos `/api/v1` e mantém access token somente em
memória, refresh em cookie `HttpOnly` e CSRF cookie-to-header. A primeira
produção precisa preservar esse contrato sem expor a origem backend ao
JavaScript, permitir CORS amplo ou conectar Previews à produção.

## Decisão

O frontend será publicado na Vercel em `app.agenciagenesis.com.br`. Um proxy
server-side encaminhará `/api/v1` para a origem fixa e server-only
`origin-api.agenciagenesis.com.br`, protegida por HTTPS e contra bypass. O
navegador nunca usa a origem diretamente.

Production recebe o destino do proxy; Preview não o recebe e falha fechado.
Cookies permanecem host-only no domínio `app`, e o hop browser→Vercel é
same-origin, sem CORS. O proxy preserva cookies, status, body e headers
contratuais, aplica `no-store` para API e impede que o fallback SPA capture
`/api/v1`.

A implementação depende de `0.8.5` (origem), `0.8.6` (proxy e segurança),
`0.8.7` (projeto Vercel) e `0.8.8` (domínio e DNS). O rollback usa uma versão
Vercel anterior validada e, quando aplicável, rollback controlado de DNS.

## Alternativas consideradas

- **B — navegador chamar a origem backend diretamente:** rejeitada para a
  primeira produção por ampliar CORS, exposição da origem e complexidade de
  cookies/CSRF.
- **C — hospedar frontend e backend juntos na Hetzner:** rejeitada para a
  primeira produção por abandonar o destino Vercel aprovado e acoplar ciclos
  de publicação sem necessidade atual.

## Consequências

A Vercel passa a ser uma fronteira server-side confiável que precisa de
configuração mínima, logs seguros, testes de proxy e separação rígida de
ambientes. A origem não pode ficar publicamente contornável, e Preview deve
perder funcionalidade de API em vez de alcançar produção. Publicação e
rollback do frontend ficam independentes do deploy da API, respeitando seus
contratos comuns.

## Implementação

Esta decisão está aceita, mas ainda não implementada. O estado atual e os
passos futuros estão em [PRODUCTION.md](../PRODUCTION.md). O backend mantém a
arquitetura geral no ADR-011 e em seu `docs/PRODUCTION.md`.
