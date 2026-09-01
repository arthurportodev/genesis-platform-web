# PIPE-V2 — Pipeline Experience V2

`PIPE-V2` é a identidade estável da iniciativa que torna o Pipeline o principal
workspace comercial da Genesis. Este documento registra seu estado-alvo durável,
limites e decomposição conceitual; não é Project State, ADR ou Task Packet.

## Visão

O Pipeline deve ser simples, rápido, visualmente silencioso e orientado à ação.
A leitura financeira é evidente e os cards são os objetos primários de trabalho,
sem ampliar a superfície do produto como um CRM generalista.

## Estado-alvo conhecido

- valor financeiro esperado por oportunidade ou ciclo comercial;
- totais financeiros autoritativos por estágio e no Pipeline completo;
- apresentação visual V2 com hierarquia comercial e baixa densidade;
- quick create dentro do contexto do Pipeline;
- drag-and-drop no desktop com fallback acessível de movimentação;
- detalhe em side panel URL-backed, preservando rota completa como fallback;
- fundação de apresentação para estágios ordenados e futuramente configuráveis;
- custom stages como programa estrutural posterior;
- refinamentos de UX que reduzam atrito sem inventar domínio.

Essas são frentes conceituais, não uma lista antecipada de Task Packets nem uma
afirmação de capacidade entregue. Task Packets definem cada delta executável,
sua ordem autorizada, dependências, gates e evidência.

## Autoridades técnicas

O [ADR-013](decisions/ADR-013-pipeline-experience-v2.md) preserva a arquitetura
de experiência. Permanecem relacionadas as decisões de Pipeline e criação no
[ADR-004](decisions/ADR-004-lead-kanban-pipeline.md) e no
[ADR-007](decisions/ADR-007-manual-lead-creation.md), além das garantias de
concorrência e transporte dos [ADR-011](decisions/ADR-011-lead-etag-canonicalization.md)
e [ADR-012](decisions/ADR-012-vercel-if-match-transport-shim.md). Este documento
não substitui nem reconta esses contratos.

Em nível de iniciativa:

- o backend continua autoridade de movimento, valores, agregados e domínio;
- DnD reutiliza a intenção e o caminho existentes de move;
- o primeiro release permanece server-confirmed, sem optimistic update;
- mobile mantém inicialmente o fallback acessível, sem exigir touch DnD;
- quick create reutiliza o contrato existente de criação;
- custom stages constituem mudança estrutural separada;
- o sorting atual permanece inicialmente;
- não se cria entidade `Opportunity` explícita por enquanto.

## Limites deliberados

Ficam fora desta iniciativa inicial multi-currency, forecasting, probabilidade,
produtos e múltiplos pipelines. Reorder manual, novo sorting, redesign do shell
e estágios configuráveis não entram por conveniência em uma tarefa de
experiência. Custom stages exigem programa Critical próprio, decisão técnica e
contratos backend antes de qualquer consumo dinâmico no Web.

Nenhuma parte deste documento autoriza implementação, dependência, migration,
endpoint, deploy ou mudança de regra. A direção visual aplicável vem de
[FRONTEND_EXPERIENCE_DIRECTION.md](FRONTEND_EXPERIENCE_DIRECTION.md), e o escopo
de produto permanece na Product Direction canônica da API.
