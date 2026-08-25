# ADR-012 — Shim de transporte If-Match na fronteira Vercel

- Estado: Proposed, candidato local aguardando Gate 2
- Data: 2026-08-25
- Especializa: ADR-010 e ADR-011

## Contexto

A concorrência otimista de Lead usa o token forte
`"lead:<leadId>:<revision>"`: o browser o obtém no detalhe, a API o exige em
`If-Match`, o PostgreSQL aplica a revisão esperada e a API responde `200` com o
novo ETag ou `412` quando a revisão está obsoleta.

Uma ocorrência real mostrou a API aplicando a mutação e respondendo `200`, mas
o browser recebendo `412` depois da borda. O probe Vercel isolado confirmou que
um `If-Match` externo divergente pode transformar a resposta pós-handler em
`412`, mesmo quando o handler respondeu `200` e mesmo sem ETag na resposta do
handler. A investigação interna do provedor não faz parte desta decisão; o
deployment e a branch do probe permanecem evidência diagnóstica independente.

## Decisão

O conceito interno `options.ifMatch` e o contrato API/PostgreSQL não mudam. O
transporte fica dividido por fronteira:

```text
Browser → Vercel Function: X-Genesis-If-Match
Vercel Function → API:     If-Match
Browser → Vite local:      X-Genesis-If-Match
Vite local → API:          If-Match
```

O cliente HTTP browser-facing nunca emite o header padrão. A Function trata
somente `X-Genesis-If-Match` como exceção nominada à remoção da família privada,
e apenas para os métodos e paths condicionais de Lead existentes. Antes do
upstream, ela exige token forte canônico com aspas, UUID do mesmo Lead presente
no path, revisão decimal canônica entre zero e o máximo de `bigint`, e limite
explícito de 63 caracteres.

A fronteira rejeita com `400` genérico e `no-store`, sem fetch upstream:

- `If-Match` externo, sozinho ou junto do header privado;
- header privado fora de método/path condicional;
- duplicata combinada, lista, vírgula, whitespace, controle ou CR/LF;
- weak ETag, wildcard, UUID/revisão incompatíveis ou valor excessivo.

O status `400` segue a política do proxy para request headers inválidos. Logs
recebem apenas um motivo enumerado e classes/booleanos já seguros, nunca o valor
do header. Após validação, o header privado é removido junto dos demais
`X-Genesis-*` e o proxy grava uma única representação `If-Match` upstream.
`Idempotency-Key` não é transformada. Responses continuam preservando status,
ETag e `no-store`, inclusive `200` de sucesso e `412` real da API.

A política de token, rota, método, duplicidade e `Connection` reside em helper
puro único. A Function usa o resultado para construir seus `Headers`; um
middleware oficialmente suportado por `configureServer` aplica o mesmo
resultado ao request que o proxy Vite realmente encaminha. O middleware só é
ativado quando o target local existe. Sem target, o plugin `503` fail-closed
continua inalterado. A API simulada E2E passa pela mesma fronteira e volta a
exigir `If-Match`, como a API real, em vez de aceitar o header browser-facing.

## Alternativas rejeitadas

- Remover optimistic concurrency, `If-Match` ou usar wildcard: perde a proteção
  contra revisão obsoleta.
- Alterar API, banco ou regra de revisão: o defeito confirmado está no hop de
  hosting depois da resposta do handler.
- Retry automático depois de `412`: pode duplicar efeitos e confundir stale real
  com transformação da plataforma.
- Aceitar genericamente `X-Genesis-*` ou qualquer ETag opaco: amplia a fronteira
  de confiança e permite ambiguidade/smuggling.
- Corrigir cada componente de Lead: duplica política que pertence ao transporte
  compartilhado e ao proxy.

## Consequências

A Vercel deixa de receber uma precondition HTTP semântica no request externo,
enquanto API e PostgreSQL continuam recebendo o mesmo `If-Match` forte. A
mitigação preserva a distinção entre mutation bem-sucedida e revisão realmente
obsoleta sem relaxar autorização, tenant scoping, idempotência ou concorrência.

Este candidato prova o contrato localmente. Ele não foi incorporado, publicado
ou observado em produção. O comportamento upstream continua reproduzível de
forma independente e o support packet existente permanece válido, sem envio
nesta execução.

Durante a primeira verificação independente, F-001 identificou que o cliente
global já usava o header privado enquanto o proxy Vite permanecia pass-through,
o que produziria `428` local. A ampliação humana de escopo incorporou o boundary
Vite e invalidou a identidade daquele candidato bloqueado; a resolução só é
válida com nova identidade, validação Critical completa e reverificação
independente.

## Evidências

- Probe Vercel isolado informado pelo operador: cases A–D e deployment
  `dpl_CrSiMzQBJD5ypbxNpKrkdh4MWqPk`.
- Web `src/shared/api/http-client.ts` e testes.
- Web `src/server/api-proxy.ts` e testes unitários/integrados.
- API read-only `src/modules/leads/controllers/leads.controller.ts` em
  `origin/main` `1a5af57818eaa2143569ce5512c7a13d515d1b77`.
