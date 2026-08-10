# ADR-008 — Vercel e proxy same-origin na primeira produção

- Estado: Accepted
- Data: 2026-07-30

## Contexto

O frontend usa paths relativos `/api/v1` e mantém access token somente em
memória, refresh em cookie `HttpOnly` e CSRF cookie-to-header. A publicação
precisa preservar esse contrato sem expor a origem backend ao JavaScript,
permitir CORS amplo ou conectar Previews à produção.

## Decisão

O frontend será publicado na Vercel. Um proxy server-side encaminhará
`/api/v1` para uma origem fixa, HTTPS, server-only e protegida contra bypass. O
navegador nunca usa a origem diretamente; os hostnames finais são decisões
operacionais registradas na memória canônica.

Production recebe o destino do proxy; Preview não o recebe e falha fechado.
Cookies permanecem host-only no domínio da aplicação, e o hop navegador→Vercel
é same-origin, sem CORS. O proxy preserva cookies, status, body e headers
contratuais, aplica `no-store` para API e impede que o fallback SPA capture
`/api/v1`.

O rollback usa uma versão Vercel anterior validada e, quando aplicável,
rollback controlado de DNS. A ordem operacional e a satisfação dos gates vêm
da autoridade temporal da API, não deste ADR.

## Alternativas consideradas

- **B — navegador chamar a origem backend diretamente:** rejeitada por ampliar
  CORS, exposição da origem e complexidade de cookies/CSRF.
- **C — hospedar frontend e backend juntos:** rejeitada para a primeira
  produção por abandonar o destino Vercel aprovado e acoplar ciclos de
  publicação sem necessidade comprovada.

## Consequências

A Vercel é uma fronteira server-side que exige configuração mínima, logs
seguros, testes de proxy e separação rígida de ambientes. A origem não pode ser
contornável, e Preview perde funcionalidade de API em vez de alcançar produção.
Publicação e rollback do frontend permanecem independentes do deploy da API,
respeitando os contratos comuns.

## Relação com memória

Este ADR responde por que a arquitetura foi escolhida. Ele não comprova
publicação, disponibilidade, hostnames, trabalho ou prontidão; esses fatos são
resolvidos pelo pointer Web na autoridade da API.
