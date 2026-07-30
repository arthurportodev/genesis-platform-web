# Produção do frontend

Este documento é a fonte canônica do frontend para Vercel, proxy same-origin,
Preview, cookies, segurança web, publicação e rollback. O plano geral de
produção, a infraestrutura Hetzner, PostgreSQL, migrations, backup, restore,
observabilidade, bootstrap, abertura e o DAG completo pertencem ao
[`docs/PRODUCTION.md` do backend](https://github.com/arthurportodev/genesis-platform-api/blob/main/docs/PRODUCTION.md).

## Estado atual

O frontend ainda não foi publicado. Não existem projeto Vercel, domínio, DNS,
proxy externo, variáveis de Production ou deploy. O `vercel.json` atual
configura somente o fallback da SPA; `/api/v1` não possui proxy de produção.
Preview permanece sem API e a aplicação não está pronta para dados reais.

## Arquitetura aceita

```text
Navegador
→ https://app.agenciagenesis.com.br
→ Vercel
→ proxy server-side de /api/v1
→ https://origin-api.agenciagenesis.com.br
→ Traefik
→ API NestJS
```

A decisão foi aprovada pelo Product Owner em 30 de julho de 2026. Ela ainda
será implementada nas tarefas `0.8.5`–`0.8.8`.

## Premissas do plano geral

Sem duplicar os procedimentos do backend, este candidato depende das mesmas
premissas canônicas: uma réplica pública da API, PostgreSQL dedicado na mesma
VPS condicionado ao inventário, roles runtime/migration separadas, secret
files ou cofre, imagens privadas no GHCR por digest, backup criptografado
externo à VPS, deploy manual e controlado e abertura progressiva. O backend é
a autoridade para os detalhes e para qualquer revisão dessas premissas.

## Contrato do proxy

- O navegador usa exclusivamente paths relativos `/api/v1`.
- O destino da origem é configuração server-only e existe somente em
  Production.
- Preview não recebe destino de produção e responde fail-closed para
  `/api/v1`; não existe fallback para outra origem.
- `/api/v1` nunca retorna o HTML da SPA nem é capturado pelo fallback de rotas.
- Métodos, status, body, cookies e headers contratuais são preservados.
- Respostas de API usam `Cache-Control: no-store` e não entram em cache de CDN.
- A origem usa HTTPS e será protegida contra bypass não autorizado.

## Cookies, CSRF e Origin

Os cookies de produção são host-only no domínio
`app.agenciagenesis.com.br`; o navegador não recebe a origem backend. O hop
browser→Vercel é same-origin e não exige CORS. Login, refresh, logout e
logout-all continuam usando CSRF cookie-to-header e validação de `Origin`.
Cookies, redirects, `Set-Cookie`, ETag, `Location`, rate-limit e demais
headers necessários ao contrato devem ser testados pelo proxy sem reescrita
insegura.

## Headers de segurança

A tarefa `0.8.6` definirá e validará os headers do frontend. Isso inclui CSP
quando compatível, proteção de framing, política de referrer, MIME sniffing e
permissões mínimas. Nenhum header está descrito aqui como aplicado antes dessa
tarefa. Valores server-only e secrets nunca entram no bundle `VITE_*`.

## Ambientes

- **Local:** proxy Vite para backend local por `GENESIS_API_PROXY_TARGET`.
- **Preview:** interface publicada quando configurada, porém `/api/v1`
  fail-closed e sem acesso à produção.
- **Production:** `app.agenciagenesis.com.br`, com proxy para a origem fixa
  protegida somente depois das tarefas dependentes.
- **Staging:** não será criado inicialmente.

## Ordem de publicação

1. `0.8.5` disponibiliza e protege a origem, TLS e firewall.
2. `0.8.6` implementa proxy e segurança do frontend, com testes de cookies,
   CSRF, Origin, no-store e fallback.
3. `0.8.7` cria o projeto Vercel ligado à `main`, usa Node.js 24 e separa
   variáveis por ambiente, ainda sem domínio final.
4. `0.8.8` configura `app.agenciagenesis.com.br`, TLS, proxy, cutover e
   rollback de DNS, sem mover zona ou nameservers.
5. `0.8.9`–`0.8.11` completam observabilidade, backup/restore, bootstrap,
   smoke e abertura controlada sob o plano backend.

## Rollback

O rollback do frontend promove novamente uma versão Vercel anteriormente
validada e imutável. Mudança de domínio/DNS possui rollback próprio na tarefa
`0.8.8`; a zona e os nameservers não serão movidos. Se a origem ou o proxy não
estiverem seguros, `/api/v1` deve falhar fechado em vez de apontar Preview ou
Production para uma alternativa não aprovada.

## Critério de abertura

Publicação técnica exige frontend, proxy, API, banco, TLS, domínio e health,
mas não basta para dados reais. Estes só entram após restore testado, smoke
sintético completo, alertas ativos, origem protegida, portas internas
bloqueadas, rotação da credencial inicial e aprovação humana específica. Os
critérios completos são autoridade do plano backend.
