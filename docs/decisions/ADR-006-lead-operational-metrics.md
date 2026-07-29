# ADR-006 — Métricas Operacionais de Leads

- Estado: Aceita e incorporada pelo PR #6 no squash
  `1ac7e26cda535cbf3e5c02dd78da4e0fb95a2e9e`
- Data: 2026-07-29

## Contexto

Inbox, Pipeline e Follow-up já atendem a execução diária, mas não devem ser
agregados no navegador para produzir indicadores gerenciais. O backend oferece
um resumo único que aplica tenant, papel, timezone, período, readiness e índices
operacionais na fonte dos dados.

## Decisão

- `/app/metrics` consome exclusivamente
  `GET /api/v1/leads/metrics/summary`; Inbox, Pipeline, Follow-up e Query Cache
  não são fontes analíticas.
- Somente owner/admin veem a navegação e montam a query. Member recebe estado
  seguro; o backend continua autoridade de autenticação, tenant e papel.
- Query keys seguem
  `organization/{id}/leads/metrics/{canonicalPeriod}`, sem persistência, dados
  sensíveis ou chave global. Troca de Organization, logout e perda de papel
  cancelam e removem os dados.
- O período default permanece omitido para o backend calcular os últimos 30
  dias civis. Ranges explícitos usam `from/to` inclusivos na query string, até
  366 dias e com datas futuras permitidas.
- Presets usam o dia civil derivado de `asOf` no `timeZone` da Organization e
  aritmética Gregoriana sem timezone do navegador ou parsing UTC de data civil.
- A resposta Zod é validada como unidade. Snapshot atual e eventos do período
  são seções diferentes; zeros permanecem dados válidos e `503` nunca vira
  vazio.
- `won` e `lost` são ciclos comerciais. A única taxa exibida é
  `won / (won + lost)`, rotulada como taxa entre ciclos ganhos ou perdidos; não
  existe conversão de Leads.
- A distribuição por source usa a atribuição inicial retornada, contagem e
  participação sobre `created`. Source futura recebe fallback seguro e todas as
  entradas são preservadas.
- Visualização usa cards, lista e barras CSS com texto equivalente. Nenhuma
  biblioteca gráfica, persistência, telemetria, tracking ou BI é adicionada.
- Query fica stale após 30 segundos, refaz por foco quando stale, aceita refresh
  manual, não possui polling e respeita rate limit/cooldown.
- Comandos invalidam Metrics somente quando alteram snapshot ou período;
  atualização cadastral, Note, Activity e movimento de estágio não invalidam.
- Desktop e mobile preservam headings, labels, touch targets, teclado,
  `aria-live`, contraste, reduced motion e informação independente de cor.

## Consequências

O frontend apresenta uma leitura operacional consistente sem duplicar regras do
backend. A página não oferece tendências, comparação entre períodos, receita,
CAC, CPL, ROAS, desempenho por vendedor ou gráficos temporais. Overview,
tracking, BI, dependências, backend, Vercel e deploy permanecem fora do escopo.

## Fontes

- Backend `src/modules/leads/controllers/leads.controller.ts`.
- Backend `src/modules/leads/dto/lead.dto.ts`.
- Backend `src/modules/leads/services/lead-operational-read.service.ts`.
- Backend `src/modules/leads/types/lead-api.type.ts`.
- Backend canônico read-only no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
