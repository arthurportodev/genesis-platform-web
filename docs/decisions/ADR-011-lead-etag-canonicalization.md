# ADR-011 — Canonicalização do validador de concorrência de Lead

- Estado: Proposed, candidato local aguardando Gate 2
- Data: 2026-08-24
- Especializa: ADR-003, ADR-004 e ADR-005

## Contexto

A API NestJS produz no GET de detalhe o ETag forte
`"lead:<leadId>:<revision>"` e aceita exatamente esse contrato em `If-Match`.
O proxy Web copia o ETag recebido do upstream sem transformá-lo, e sua regressão
local exige que um valor forte permaneça forte na `Response` retornada pelo
handler.

No ambiente Vercel real, o browser recebeu
`W/"lead:<leadId>:<revision>"`. A requisição seguinte reutilizou esse valor em
`If-Match`, e a API respondeu `400 Invalid If-Match.` antes da regra de negócio.
Edição, nota, próxima ação e movimento falharam pelo mesmo motivo porque todas
consomem o snapshot central do detalhe.

A divergência ocorre depois de `handleApiProxy`, na materialização da resposta
pela camada de hosting. A documentação da Vercel posiciona Functions atrás da
CDN e declara compressão automática nessa camada; ela não oferece neste contrato
um controle versionado que garanta a preservação strong do ETag depois do
handler. O componente interno exato que acrescenta `W/` não é observável no
repositório Web e não é necessário para provar a fronteira: upstream, handler
local e browser real já delimitam o hop divergente.

## Decisão

O transporte HTTP compartilhado continua tratando ETags como opacos. A
fronteira `createLeadSnapshot`, que possui simultaneamente o ETag recebido e o
`leadId`/`revision` do body validado, aplica a única exceção de domínio:

- aceita sem mudança o valor forte canônico
  `"lead:<leadId>:<revision>"`;
- aceita `W/` somente quando o restante do valor é byte a byte o mesmo token
  canônico para o id e a revisão recebidos no mesmo Lead;
- armazena internamente apenas o valor forte canônico esperado pela API;
- rejeita outro Lead, outra revisão, wildcard, valor ausente e qualquer formato
  arbitrário ou malformado.

Revision não fabrica autoridade por si só: ela apenas participa da prova de
equivalência com o ETag efetivamente recebido. O snapshot continua sendo a fonte
única de `If-Match`, e `assertCurrentLeadSnapshot` ainda exige a mesma identidade
e revisão no momento da mutação.

## Alternativas rejeitadas

- Remover `If-Match`, usar `*` ou relaxar a API: elimina ou enfraquece optimistic
  concurrency.
- Remover `W/` cegamente: aceitaria um token não comprovado contra o Lead e a
  revisão do body.
- Alterar cada mutação: duplica a política e amplia o risco de divergência.
- Duplicar o validador em novo response header no proxy: cria contrato entre
  handler e browser, toca uma fronteira protegida maior e ainda exige regressão
  específica de hosting.
- Depender de uma configuração de compressão/no-transform não documentada:
  deixa o comportamento crítico fora do contrato versionado do repositório.

## Consequências

Todas as mutações que usam o snapshot de detalhe voltam a enviar o validador
forte aceito pela API, sem replay automático nem mudança em idempotência,
autorização, Organization scoping, sessão, proxy ou regras de Lead. A leitura do
detalhe falha fechado se a resposta não provar a relação
`ETag ↔ leadId ↔ revision`.

ADRs anteriores continuam válidos quanto ao uso de detalhe compatível, ausência
de ETag fabricado a partir de filas/Kanban e concorrência server-confirmed. Fica
superada apenas a afirmação de que o snapshot de Lead aceita qualquer ETag
opaco.

## Fontes

- Web `src/features/leads/api/lead-snapshot.ts` e testes associados.
- Web `src/server/api-proxy.ts` e `src/server/api-proxy.test.ts`.
- API `src/modules/leads/controllers/leads.controller.ts` em `origin/main`
  `61a63d245ee4b0182dfb3d3b7f13bfc72309c7e9`.
- Vercel, `How Vercel CDN works`, consultado em 2026-08-24.
- Captura de Network sanitizada fornecida pelo operador em 2026-08-24.
