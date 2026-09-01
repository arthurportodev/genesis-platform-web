# Fluxo de desenvolvimento

## Preparação e Gate 1

1. Classifique a tarefa e escolha separadamente o perfil técnico.
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

Use `npm run task:validate`; o plano depende do perfil, não do nome da classe. O
perfil `critical` cobre preflight, formatação, lint, TypeScript, task tools,
Vitest, build e Playwright. Gere fingerprints texto e JSON depois da última
alteração material e entregue o diff a verifier independente quando exigido.

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

## Contrato V2 e identidade do candidato

O Task Manifest usa `contractVersion: 2.0.0`, mas o parser mantém dual-read de
V1/V2. O V2 declara níveis de validação, fontes de reidratação, gatilhos de
expansão, envelope de autonomia, artefatos estruturados e o conjunto canônico.

`npm run task:contracts` valida os cinco schemas, as três Skills, o
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
