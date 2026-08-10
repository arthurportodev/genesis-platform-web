# ADR-009 — Paridade frontend do Sistema Operacional de Desenvolvimento V2

## Status

Accepted.

## Contexto

O backend é a autoridade do Sistema Operacional de Desenvolvimento V2 aprovado
no commit `ad8e36772bed7910c2d484255ce2c806024ce04d`. O frontend precisa aplicar
as mesmas invariantes sem copiar comandos próprios de NestJS, banco ou Docker e
sem criar uma segunda autoridade.

## Decisão

Adotar `contractVersion: 2.0.0` com distribuição controlada:

- as duas Skills e os cinco schemas compartilhados permanecem byte a byte
  idênticos ao upstream;
- `schemas/development-operations/contract-set.json` registra repositório,
  commit upstream e SHA-256 de cada arquivo compartilhado;
- `npm run task:contracts` reprova drift de versão, upstream, paths ou hashes;
- Task Manifest V1 e V2 coexistem por dual-read, com normalização para as
  invariantes V2;
- identidade do candidato separa `contentFingerprint`,
  `gitStateFingerprint` e `candidateId`, incluindo tipo Git, modo efetivo e
  conteúdo após clean filter;
- artefatos transitórios só são excluídos se forem arquivos regulares,
  ignorados e não rastreados;
- tarefas Critical invocam explicitamente orchestrator e verifier, e o verifier
  é independente e read-only;
- o perfil Critical do frontend executa contratos, formatação, lint, typecheck,
  52 testes do ferramental, Vitest, build e Playwright.

## Consequências

O backend continua sendo a única autoridade contratual. Mudança compartilhada
começa no backend e exige atualização explícita do commit e hashes no frontend.
Diferenças de comandos permanecem locais e testadas. A coexistência V1/V2 evita
migração instantânea de tarefas em andamento.

Esta decisão não autoriza stage, commit, publicação, merge, deploy ou qualquer
mutação de produção.

## Snapshot histórico de implementação

O candidato descrito originalmente por este ADR foi incorporado no frontend
pelo squash `890a49fb62fd194f8c2adf04fbfeb0cdd84e32bf`. Esse registro é
proveniência histórica; o contrato vigente continua sendo verificado por
`contract-set.json` e `npm run task:contracts`.
