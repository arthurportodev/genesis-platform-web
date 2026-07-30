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
8. `PRODUCTION.md`: estado e plano específico de Vercel, proxy e publicação.
9. `decisions/README.md`: decisões arquiteturais vigentes.

Consulte `ROADMAP.md`, `TASK_LOG.md` e `PROMPT_TEMPLATES.md` conforme a tarefa.

## Roteamento operacional V2

Reidrate primeiro apenas as fontes diretamente relacionadas ao delta registradas
no Task Manifest. Expanda a leitura quando houver drift de base, autoridade
conflitante, impacto em fronteira protegida, finding High sem causa local ou
qualquer finding Critical. Em tarefas Critical, invoque
`$genesis-task-orchestrator` e, para a revisão final read-only,
`$genesis-independent-verifier`. O fallback sem Skills preserva exatamente os
mesmos contratos em `AGENTS.md`, schemas e scripts.

## Regra de honestidade operacional

O frontend possui integração de autenticação, sessão e Organization com os seis
endpoints web de `/api/v1/auth`, além de Inbox, detalhe e Pipeline de Leads sobre
os contratos oficiais, inclusive as filas operacionais de Follow-up e o resumo
agregado de Metrics para owner/admin. A tarefa `0.7.6`, incorporada pelo PR #7,
acrescenta criação
manual server-confirmed para owner, admin e member, sem persistir o formulário
ou antecipar deduplicação. Isso não torna guards frontend uma fronteira de
autorização. Estados vazios e indisponíveis continuam obrigatórios onde não
existe endpoint integrado. A Fase `0.7` terminou e a Fase `0.8` é a atual;
Vercel, domínio, proxy de produção e deploy ainda não existem.
