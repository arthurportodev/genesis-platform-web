# ADR-004 — Pipeline Kanban de Leads

- Estado: Proposta no candidato `0.7.3`
- Data: 2026-07-29

## Contexto

A Inbox e o detalhe de Leads já consumiam sessão, Organization ativa, cliente
HTTP, cache tenant-scoped, ETag e idempotência. O Pipeline precisava usar o
endpoint agregado e o comando de move existentes sem duplicar infraestrutura,
inventar contrato ou expor PII desnecessária.

## Decisão

- O Pipeline possui os estágios canônicos `new`, `qualification`, `diagnosis`,
  `proposal` e `negotiation`; eles não são customizáveis no frontend.
- A carga inicial faz um único GET agregado. Cada coluna possui continuação
  independente com o mesmo filtro, seu estágio e cursor opaco.
- Queries seguem a raiz de Leads com Organization. A estratégia híbrida combina
  a query inicial e uma infinite query por coluna, todas abortáveis, com
  `staleTime` de 15 segundos e sem refetch por foco ou polling.
- Duplicidades entre páginas são resolvidas por `id`, maior `revision` e `asOf`
  mais recente. Totais continuam sendo os valores do backend.
- Desktop mostra cinco colunas com scroll horizontal; mobile mostra uma etapa
  por vez. O controle acessível `Mover para` substitui drag-and-drop e exige
  confirmação explícita.
- O movimento é server-confirmed. O card permanece na origem durante preflight,
  comando e releitura, sem optimistic update.
- Como o Kanban não fornece ETag, o frontend usa apenas um snapshot de detalhe
  exatamente compatível como otimização; caso contrário, busca o detalhe. O ETag
  é opaco e nunca é reconstruído.
- A intenção idempotente vincula Organization, Lead, revisão de origem e
  destino. Resultado remoto incerto preserva ETag e chave até retry ou abandono
  explícito; `409/412` encerram a intenção sem retry automático.
- Sucesso refaz o Kanban completo do filtro e invalida Inbox, detalhe e timeline.
- Cards exibem somente nome, empresa, responsável, resumo temporal da próxima
  ação, atualização e retorno pendente. PII adicional fica no cache em memória.
- O backend continua autoridade de tenant, visibilidade, papel e transição.
- Nenhuma dependência foi adicionada.

## Consequências

O Pipeline opera com paginação e concorrência compatíveis com o backend e uma
alternativa acessível a drag-and-drop. A releitura completa prioriza correção em
vez de resposta visual otimista. Criação manual, estágios customizáveis, filas,
métricas, Vercel e deploy continuam fora do escopo.

## Fontes

- Backend `src/modules/leads/controllers/leads.controller.ts`.
- Backend `src/modules/leads/dto/lead.dto.ts`.
- Backend `src/modules/leads/types/lead-api.type.ts`.
- Backend canônico read-only no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
