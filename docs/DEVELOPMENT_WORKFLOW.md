# Fluxo de desenvolvimento

## Preparação e Gate 1

1. Classifique a tarefa e escolha separadamente as validation surfaces.
2. Quando houver arquitetura, segurança ou contrato estrutural, obtenha Gate 1
   humano antes da implementação.
3. Crie branch dedicada a partir do SHA-base aprovado.
4. Prepare manifesto e Task Packet quando exigidos pela classe.
5. Execute `npm ci` e `npm run task:preflight`.

## Implementação

- Faça mudanças pequenas e coerentes com o escopo permitido.
- Atualize testes junto do comportamento.
- Não misture correções oportunistas ou arquivos fora do manifesto.
- Dependências devem ter finalidade explícita e lockfile revisado.
- Durante esta fase, stage, commit, push e criação de PR são proibidos.

## Memória canônica cross-repo

A API é a única autoridade temporal; o Web mantém pointer-only e uma bridge
sem projeção. Uma transição cross-repo é preparada Web-first/API-last:

1. o candidato Web registra receipt com `baseSha`, `targetStateRevision` e
   `revisionSource=containing-commit`;
2. a janela intermediária é reportada como `MEMORY_TRANSITION_PENDING`, sem
   fallback para documentos Web;
3. o candidato API registra o SHA Web final como `memoryRevision`, valida esse
   commit e ativa a revisão-alvo no mesmo PR autoritativo.

O schema API deve representar `nextTask` como `identified`, `undecided` ou
`none`; placeholders como `TBD` são proibidos. Fatos temporais e projeção API
são atualizados atomicamente na tarefa que muda o estado, sem closeout separado.
Roadmap, ADR e TASK_LOG preservam direção, decisão e história, respectivamente.

## Validação e Gate 2

Use `npm run task:validate`; no Task Manifest V3, o plano compõe os checks base
e a união determinística das surfaces declaradas. A classe continua definindo
governança e o rigor aplicável dentro de cada surface. Gere fingerprints texto
e JSON depois da última alteração material e entregue o diff a verifier
independente quando exigido.

O classificador versionado infere `memory`, `app`, `production` e `tooling`
somente a partir dos paths Git. As surfaces do manifesto podem ampliar essa
união, mas não podem omiti-la; path sem regra bloqueia o preflight e a CI. Um
delta misto executa cada comando compartilhado uma única vez. Mudanças em
`package.json` ou `package-lock.json` selecionam conservadoramente App,
Production, Tooling e build/scan da imagem.

Em Pull Requests, o check obrigatório `Validate frontend` valida os pais do
merge ref contra base e head declarados, classifica o delta e executa apenas a
união selecionada. O browser Playwright é instalado somente quando App ou
Production forem selecionadas; deltas exclusivos de Memory ou Tooling não
pagam esse custo.

Em push para `main`, o mesmo check executa somente integridade: `git diff
--check`, classificação fail-closed, contratos básicos de desenvolvimento e
parse/resolução do pointer de memória. Esse caminho não instala dependências,
browser ou suítes completas. `workflow_dispatch` oferece `full`, para a união
ativa completa, e `integrity`, para reproduzir a checagem curta de `main`.

Gate 2 é a decisão humana sobre o candidato estável. Nenhuma entrega remota pode
começar antes dele. Correções encontradas durante revisão ou entrega retornam ao
builder, repetem validação e verifier e produzem novo fingerprint.

## Entrega remota e Gate 3

Após Gate 2, uma autorização específica designa um único operador para serializar
stage, commit, push e criação do PR. Gate 3 é curto, humano e específico para o
PR e seu head SHA; qualquer mudança de head invalida a aprovação.

Com Gate 3 e checks verdes no head aprovado, use squash merge. Depois:

1. confirme a CI pós-merge na `main`;
2. sincronize a `main` local;
3. remova branches locais/remotas e artefatos transitórios autorizados;
4. registre o fechamento.

Tag, release, deploy, Vercel, domínio e DNS são autorizações independentes.

## Invariante do Remote Operator

`remoteOperatorStatus=conceptual-only`. A capability não existe como
implementação nem autorização operacional. Qualquer desenho futuro exige
contrato, allowlist, locks, dry run, rollback e autorização próprios, com um
writer por recurso compartilhado. Cada execução deve produzir
`evidence-manifest.v1` vinculado ao candidato e ao operador. Disponibilidade de
ferramenta nunca concede permissão de mutação.

## Contrato e identidade do candidato

O Task Manifest V3 usa `contractVersion: 2.0.0` e declara validation surfaces.
O parser mantém dual-read V1/V2 como legacy read com os planos anteriores e normaliza as
três versões. V2 continua declarando níveis, reidratação, autonomia, artefatos
estruturados e o conjunto canônico.

`npm run task:contracts` valida os seis schemas, as três Skills, o
manifesto-exemplo, o commit upstream e os hashes de paridade. No Web, a Skill de
frontend permanece projeção tracked derivada do upstream API declarado; somente
a API é autoridade editável. O fingerprint V2 separa:

- `contentFingerprint`: path, tipo Git, modo efetivo e conteúdo após o clean
  filter;
- `gitStateFingerprint`: branch, base e classificação
  committed/staged/unstaged/untracked;
- `candidateId`: task, base, versão do contrato e conteúdo.

A transição `untracked-to-tracked` só é válida quando declarada, o conjunto de
paths e o conteúdo permanecem idênticos e o index/commit representa integralmente
o candidato. Artefatos locais só são excluídos quando são arquivos regulares,
ignorados e não rastreados; um path rastreado nunca pode ser ocultado por ser
declarado como artefato.

No frontend, `npm test` limita o Vitest a um worker para evitar contenção e
timeouts não determinísticos nos testes de interface. Isso altera apenas o
agendamento do runner, não a cobertura nem os limites individuais dos testes.

Artifacts transitórios novos devem usar `.codex/task-packets/<task-id>/` e ser
removidos no closeout quando não tiverem valor durável. A validação de formato
usa a seleção Git de arquivos tracked e untracked não ignorados; artifacts
ignored permanecem fora do candidate, enquanto arquivos novos legítimos
continuam visíveis.
