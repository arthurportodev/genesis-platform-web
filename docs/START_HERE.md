# Comece aqui

Este é o ponto de entrada obrigatório para trabalho no frontend.

## Ordem de leitura

1. `memory/project-state.pointer.v1.json`: localize e valide a autoridade
   temporal da API; indisponibilidade é explícita e não admite fallback local.
2. `CURRENT_STATE.md`: bridge estável e comportamento de resolução.
3. `PROJECT_OVERVIEW.md`: produto, escopo e limites estruturais.
4. `ARCHITECTURE.md`: módulos, dependências e fluxo de execução.
5. `TASK_CLASSIFICATION.md`: classe e validação proporcional.
6. `DEVELOPMENT_WORKFLOW.md`: processo local, memória e entrega.
7. `MULTI_AGENT_OPERATING_MODEL.md`: coordenação e propriedade de arquivos.
8. `SECURITY.md`: fronteiras de segurança.
9. `PRODUCTION.md`: contrato estável de Vercel, proxy e publicação.
10. `decisions/README.md`: decisões arquiteturais, nunca status temporal.

Consulte `ROADMAP.md`, `TASK_LOG.md` e `PROMPT_TEMPLATES.md` conforme a tarefa.

## Roteamento operacional V2

Reidrate primeiro apenas as fontes diretamente relacionadas ao delta registradas
no Task Manifest. Expanda a leitura quando houver drift de base, autoridade
conflitante, impacto em fronteira protegida, finding High sem causa local ou
qualquer finding Critical. Em tarefas Critical, invoque
`$genesis-task-orchestrator` e, para a revisão final read-only,
`$genesis-independent-verifier`. O fallback sem Skills preserva exatamente os
mesmos contratos em `AGENTS.md`, schemas e scripts.

Para um delta frontend, não pré-carregue todo o programa. Resolva na ordem:

1. Task Packet e Manifest;
2. ADR diretamente relacionado;
3. [PIPELINE_EXPERIENCE_V2.md](PIPELINE_EXPERIENCE_V2.md), somente para
   `PIPE-V2`;
4. [FRONTEND_EXPERIENCE_DIRECTION.md](FRONTEND_EXPERIENCE_DIRECTION.md), quando
   houver decisão de UX;
5. Product Direction canônica da API, somente quando houver decisão de produto
   ou escopo.

`$genesis-frontend-product-engineer` aplica uma lente especializada sobre essas
fontes; não substitui nenhuma delas nem amplia o delta autorizado.

## Regra de honestidade operacional

Código e testes sustentam capacidades implementadas; ADRs sustentam decisões;
o contrato de produção sustenta gates. Fase, trabalho, publicação, blockers e
decisões humanas vêm somente da autoridade temporal resolvida. Um agente não
pode promover um snapshot histórico, este roteador ou a bridge Web a estado
vigente, nem confundir documentação versionada com observação live.
