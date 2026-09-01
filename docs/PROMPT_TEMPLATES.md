# Modelos de prompt

Em tarefa Critical, comece com `$genesis-task-orchestrator`. Depois que o
candidato estiver estável e validado, use `$genesis-independent-verifier` em
execução independente e estritamente read-only. Sem suporte a Skills, declare o
fallback e aplique os mesmos schemas, scripts, Gates e evidências.
Quando o delta envolver frontend, produto ou experiência, aplique
`$genesis-frontend-product-engineer` como lente do Builder, sem promovê-la a
papel ou autoridade e sem ampliar as fontes além do delta.

## Implementação

```text
Implemente a tarefa <id> no frontend oficial.
Classe: <Simple|Normal|Critical>.
Perfil técnico: <docs|focused|normal|critical>.
Gate 1, quando exigido: <evidência>.
Base aprovada: <sha>.
Escopo permitido: <caminhos>.
Critérios de aceitação: <lista verificável>.
Proibições e decisões humanas: <lista>.
Execute preflight, validação do perfil, fingerprints texto/JSON e reporte o diff.
Registre contractVersion, upstream, contentFingerprint, gitStateFingerprint e
candidateId.
Não faça stage, commit, push, PR ou operações remotas antes do Gate 2.
```

## Revisão somente leitura

```text
Revise o diff da tarefa <id> contra <sha> sem editar arquivos.
Skill: $genesis-independent-verifier.
Priorize segurança, contratos, arquitetura, acessibilidade, testes e escopo.
Reporte findings com severidade, arquivo, linha e evidência. Declare
explicitamente quando não houver findings e vincule o resultado ao fingerprint.
```

## Entrega remota

```text
Gate 2 aprovado para o fingerprint <fingerprint>.
Como operador Git único, prepare commit e PR sem alterar o candidato.
Pare para Gate 3 humano específico ao PR <número> e head SHA <sha>.
Após Gate 3 e checks verdes no mesmo head, faça squash merge, confirme CI da
main, sincronize main e remova branches/artefatos autorizados.
Qualquer correção retorna ao builder e ao verifier.
```
