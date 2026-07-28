# Comece aqui

Este é o ponto de entrada obrigatório para trabalho no frontend.

## Ordem de leitura

1. `PROJECT_OVERVIEW.md`: produto, escopo e limites atuais.
2. `CURRENT_STATE.md`: o que existe hoje e o que ainda não existe.
3. `ARCHITECTURE.md`: módulos, dependências e fluxo de execução.
4. `TASK_CLASSIFICATION.md`: classe e validação proporcional.
5. `DEVELOPMENT_WORKFLOW.md`: processo local e entrega.
6. `MULTI_AGENT_OPERATING_MODEL.md`: coordenação e propriedade de arquivos.
7. `SECURITY.md`: fronteiras de segurança.
8. `decisions/README.md`: decisões arquiteturais vigentes.

Consulte `ROADMAP.md`, `TASK_LOG.md` e `PROMPT_TEMPLATES.md` conforme a tarefa.

## Regra de honestidade operacional

O frontend possui integração de autenticação, sessão e Organization com os seis
endpoints web de `/api/v1/auth`. Isso não torna guards frontend uma fronteira de
autorização e não torna dados de CRM disponíveis. Estados vazios e indisponíveis
continuam obrigatórios onde não existe endpoint integrado.
