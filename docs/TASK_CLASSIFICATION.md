# Classificação de tarefas e validation surfaces

Classe e validation surface são decisões distintas. Registre ambas antes de editar.

## Classes de tarefa

| Classe   | Uso                                                                                | Controles operacionais                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simple   | Delta pequeno, reversível e de baixo risco                                         | builder único; manifesto/Task Packet apenas quando exigidos pelo contexto; autonomia limitada ao escopo                                                    |
| Normal   | Feature, correção ou refatoração com impacto delimitado                            | manifesto e Task Packet; builder e revisão proporcional; Gate 2 antes da entrega remota                                                                    |
| Critical | Bootstrap, segurança, sessão, arquitetura, CI, dependências ou mudança transversal | Gate 1 de arquitetura quando aplicável; manifesto e Task Packet obrigatórios; builder único; verifier independente; Gate 2 humano; interrupções reforçadas |

A classe define papéis, Gates, artefatos operacionais, autonomia e condições de
interrupção. `docs` e `focused` não são classes.

## Validation surfaces

O Task Manifest V3 exige uma ou mais surfaces explícitas:

| Surface    | Validação técnica                                                       |
| ---------- | ----------------------------------------------------------------------- |
| memory     | Schema, validator, projection e testes do sistema de memória            |
| app        | Formato, lint, tipos/build, unit e E2E aplicável                        |
| production | Runtime, release, package e contratos de Production                     |
| tooling    | Manifesto, preflight, fingerprint, contracts, planner e task-tool tests |

Classe e surface são independentes. Critical preserva Task Packet, verifier,
Gates e autorização humana mesmo com uma surface pequena. Surfaces mistas
executam a união determinística dos planos sem repetir comandos comuns.

Reconciliar em Memory um resultado de Production já observado não constitui
deployment nem nova operação de Production. A classificação segue o delta
documental e a validation surface é `memory`.

Manifestos V1/V2 com `validation.profile` permanecem aceitos somente como
legacy read durante a transição e conservam o comportamento anterior.

Eleve a classe ou interrompa quando houver dúvida sobre impacto transversal.
Findings médios ou maiores em segurança, contratos, supply chain, arquitetura,
CI, GitHub, escopo ou dependências exigem decisão humana.

## Gates, severidade e autonomia V2

Gate 1 aprova decisões estruturais; Gate 2 aprova um candidato identificado por
base, caminhos, `contentFingerprint` e `candidateId`; Gate 3 autoriza merge
de um PR e head SHA específicos. CI verde não presume nenhum Gate.

Critical sempre interrompe. Low e Medium admitem correção proporcional dentro
do escopo. High admite correção autônoma somente quando a invariável já está
aprovada, existe uma correção dominante, local, reversível e objetivamente
verificável, sem decisão material nem mudança de fronteira proibida. A correção
exige finding estruturado, regressão específica, validações focused e Critical,
novo fingerprint/ID e reverificação independente. Reclassificar Critical exige
evidência objetiva e candidato inalterado.
