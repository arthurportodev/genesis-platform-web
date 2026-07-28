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
