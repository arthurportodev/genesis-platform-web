# Contrato de produção do frontend

Este documento preserva somente as decisões e os gates estáveis do frontend.
Fatos operacionais, disponibilidade de provedores, nomes finais, trabalho em
curso e restrições vigentes pertencem à memória canônica da API, resolvida pelo
[pointer Web](memory/project-state.pointer.v1.json).

## Arquitetura aprovada

O destino de publicação do frontend é a Vercel. O navegador usa exclusivamente
paths relativos `/api/v1`; um proxy server-side same-origin encaminha essas
requisições para uma origem HTTPS protegida e não acessível diretamente pelo
JavaScript. Hostnames e fatos operacionais são resolvidos exclusivamente pela
memória canônica da API; este contrato não declara DNS, deploy ou
disponibilidade live.

Preview não recebe o destino de produção e falha fechado para `/api/v1`. O
fallback da SPA nunca pode capturar paths de API.

Deployments automáticos originados pelo Git permanecem globalmente desativados
por `git.deploymentEnabled=false`. A proteção não impede um deployment manual
controlado, mas merge e publicação são operações separadas: incorporar uma
revisão não a promove. Cada deployment manual e cada promoção exigem sua própria
autorização e não são autorizados por este documento.

O entrypoint da Function usa import ESM relativo com extensão `.js`. A CI
compila uma réplica fechada do pacote Node.js, exige todos os módulos internos
dentro do bundle e inicializa o entrypoint empacotado. O teste também executa
GET, HEAD e OPTIONS em Preview sintético, exige `404`/`no-store` e prova zero
contato upstream. O build da SPA isolado não substitui essa regressão.

Em Production, a autoridade pública é aceita somente quando `Host` e
`X-Forwarded-Host` concordam exatamente com o hostname final e
`X-Forwarded-Proto` é exatamente `https`. No roteador Vercel observado, a
Function recebe o pathname público `/api/v1/...`; o destino do rewrite combina
na query exatamente um `__genesis_proxy_path`, com barras percent-encoded. A
Function exige que o capture decodificado corresponda byte a byte ao sufixo do
pathname público, remove somente esse parâmetro reservado e preserva a query
pública. Capture ausente, duplicado, malformado ou divergente falha fechado.
Preview, acesso por host gerado, headers ausentes ou divergentes e protocolo
diferente de HTTPS continuam fail-closed antes do upstream.

## Contrato do proxy

- O destino da origem é configuração server-only, nunca uma variável `VITE_*`.
- Métodos, status, body, cookies e headers contratuais são preservados.
- Respostas de API usam `Cache-Control: no-store` e não entram em cache de CDN.
- A origem usa HTTPS e precisa ser protegida contra bypass.
- Ausência, erro ou configuração incompleta do proxy falha fechado.
- Nenhuma alternativa de Preview ou origem não aprovada é usada como fallback.
- A Function Node.js 24 possui timeout upstream de 8 segundos, duração máxima
  versionada de 10 segundos e bodies limitados a 4,5 MB.
- Headers hop-by-hop fixos e indicados por `Connection` são removidos nos dois
  sentidos. Headers forwarded/internos do cliente são removidos e substituídos
  pela proveniência server-side descrita no ADR-010.
- O browser nunca envia `If-Match` à Vercel. Operações condicionais de Lead usam
  `X-Genesis-If-Match`; a Function aceita somente o token forte canônico
  compatível com método/path, rejeita ambiguidade antes do upstream, remove o
  header privado e sintetiza exatamente um `If-Match` para a API. A API e sua
  semântica `200`/ETag ou `412` permanecem inalteradas.
- `Location` só sobrevive como path relativo em `/api/v1`; cookies exigem
  `Secure`, `Path=/` e ausência de `Domain`.
- `Cache-Control`, `CDN-Cache-Control` e `Vercel-CDN-Cache-Control` são sempre
  `no-store`; metadados de HIT do upstream nunca são propagados.

## Cookies, CSRF e Origin

Cookies de sessão permanecem host-only no domínio da aplicação. O hop
navegador→Vercel é same-origin e não exige CORS. Login, refresh, logout e
logout-all preservam CSRF cookie-to-header e validação de `Origin`. Cookies,
redirects, `Set-Cookie`, ETag, `Location`, rate-limit e os demais headers do
contrato precisam de verificação ponta a ponta no candidato de publicação.
O candidato local cobre esses casos adversarialmente; a borda Vercel e os
cookies do hostname final ainda exigem verificação pós-deploy.
O comportamento de precondition da Vercel permanece reproduzível no probe
isolado e elegível para suporte do provedor; o shim local não declara correção
da plataforma nem observação desta mitigação em produção.

## Ambientes

- **Local:** proxy Vite para backend local por `GENESIS_API_PROXY_TARGET`, com a
  mesma política compartilhada que traduz `X-Genesis-If-Match` validado em um
  único `If-Match` upstream; sem target, permanece `503` fail-closed.
- **Preview:** interface isolada, `/api/v1` fail-closed e sem acesso à produção.
- **Production:** Vercel com proxy same-origin para uma origem protegida.
- **Staging:** somente mediante decisão posterior explícita.

Por essa fronteira, Preview valida a interface e o comportamento fail-closed,
mas não valida o fluxo autenticado completo contra a API de produção. O smoke
same-origin ponta a ponta pertence exclusivamente ao domínio aprovado após uma
promoção autorizada.

## Gates de publicação e abertura

Publicação técnica exige candidato imutável, CI no head aprovado, proxy, API,
banco, TLS, domínio e health verificados. Dados reais exigem ainda restore
testado, smoke sintético, teste adversarial cross-tenant, alertas, origem
protegida, portas internas bloqueadas, rotação da credencial inicial e aprovação
humana específica. A autoridade da API registra a satisfação ou pendência
desses gates; este contrato não declara seu resultado.

## Rollback

Toda promoção preserva o deployment anterior e é seguida imediatamente pelos
smokes de raiz, autenticação e proxy. O rollback do frontend promove essa versão
Vercel anterior, validada e imutável.
Mudanças de domínio/DNS têm rollback próprio. Se origem ou proxy não estiverem
seguros, `/api/v1` falha fechado. A sequência operacional, o candidato anterior
e a evidência de recuperação devem estar identificados antes da publicação.

Este documento não autoriza deploy, mutação de Vercel, DNS, infraestrutura ou
dados reais.
