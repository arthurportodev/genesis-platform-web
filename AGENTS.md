# AGENTS.md

Estas regras valem para todo o repositório e integram o Sistema Operacional de
Desenvolvimento da Genesis Platform.

## Antes de alterar código

1. Leia `docs/START_HERE.md` e os documentos apontados por ele.
2. Classifique a tarefa como `Simple`, `Normal` ou `Critical` conforme
   `docs/TASK_CLASSIFICATION.md`.
3. Escolha separadamente o perfil técnico `docs`, `focused`, `normal` ou
   `critical` conforme o delta real. Uma tarefa `Critical` sempre usa `critical`.
4. Quando exigido pela classe, crie `.codex/task-manifest.json` a partir do
   exemplo e um Task Packet em `.codex/task-packets/<id>.md`.
5. Confirme branch, SHA-base, estágio limpo e escopo com
   `npm run task:preflight`.

## Gates e Git

- Gate 1 aprova arquitetura e contrato antes da implementação quando a tarefa
  exigir decisão estrutural.
- Gate 2 aprova o candidato estável depois da validação e do verifier
  independente. Antes dele são proibidos stage, commit, push e criação de PR.
- Entrega remota exige autorização específica posterior ao Gate 2.
- Gate 3 é uma confirmação humana curta e específica para o PR e seu head SHA.
  O SHA aprovado não pode mudar depois do Gate 3.
- O merge é squash, condicionado aos checks do head aprovado. Depois do merge,
  confirme a CI da `main`, sincronize a `main` local e remova branches e
  artefatos transitórios autorizados.
- Operações Git remotas são serializadas por um único operador. Correções
  descobertas durante a entrega retornam ao builder, à validação e ao verifier;
  não são aplicadas diretamente no fluxo remoto.

## Limites permanentes

- Não invente contratos de API, sessão, autorização ou organização.
- Não use dados reais, tokens, segredos, cookies improvisados ou armazenamento
  local para representar autenticação.
- Trate dados exibidos como indisponíveis até existir integração oficial.
- Mantenha TypeScript estrito, acessibilidade e comportamento responsivo.
- Preserve a separação entre `app`, `features` e `shared` descrita na arquitetura.
- Toda dependência nova exige justificativa e revisão de cadeia de suprimentos.
- Não altere infraestrutura remota, Vercel, regras do GitHub ou outro
  repositório sem autorização explícita.

## Entrega

- Execute o perfil de validação registrado no manifesto.
- O check obrigatório da CI é `Validate frontend`.
- Registre estado e decisões relevantes nos documentos canônicos.
- Não faça commit, push, PR, merge, tag, release ou deploy sem o Gate aplicável e
  autorização específica.
