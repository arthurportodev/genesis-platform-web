# Modelos de prompt

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
Não faça stage, commit, push, PR ou operações remotas antes do Gate 2.
```

## Revisão somente leitura

```text
Revise o diff da tarefa <id> contra <sha> sem editar arquivos.
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
