# Modelo operacional multiagente

## Papéis

- O coordenador mantém escopo, Gates e decisões humanas.
- Um único builder possui a escrita em cada arquivo e integra o candidato.
- O verifier revisa o diff completo em modo estritamente read-only.
- Um único operador Git serializa operações remotas somente depois das
  autorizações aplicáveis.

O Task Packet registra classe, perfil, base, ownership e condições de
interrupção. Classe determina os papéis e Gates; perfil determina apenas a
profundidade técnica.

## Coordenação

Antes de paralelizar análises, divida subtarefas independentes e preserve um só
owner de escrita. O builder executa a validação canônica e responde por
divergências de escopo. Em tarefas `Critical`, o verifier é independente e não
edita arquivos.

Findings médios ou maiores nas áreas críticas definidas em
`TASK_CLASSIFICATION.md` exigem pausa. Correções descobertas na revisão ou na
entrega retornam ao builder, repetem validação e reverificação e invalidam o
fingerprint anterior.

## Operações remotas

Stage, commit, push e PR são proibidos antes do Gate 2. Depois de autorização
específica, um operador único os executa em sequência. Gate 3 aprova um PR e head
SHA determinados; o merge é squash e protegido por esse SHA. O operador também
confirma a CI pós-merge, sincroniza `main` e remove branches e artefatos
transitórios autorizados.
