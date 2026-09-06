# Runbook de deployment

Este runbook aplica o menor sistema seguro. Ele referencia o deploy simples da
API definido pelo ADR-020 no repositório
`arthurportodev/genesis-platform-api` e o fluxo manual Vercel deste
repositório. Não cria plataforma, staging, transação distribuída ou autorização
de Production.

## Lifecycle durável

```text
Product Task
→ Discovery
→ Task Classification
→ minimum Validation Surfaces
→ Implementation
→ delta-aware validation
→ verifier e Gates quando exigidos
→ Pull Request / merge
→ immutable candidate
→ Production Gate
→ promotion
→ Production Health
→ Manual Product Acceptance
→ KEEP / ROLLBACK
→ one Memory V2 terminal closeout
```

Automated Feature Validation e checkpoints adicionais entram somente quando o
risco da tarefa os exigir.

## Classifique a superfície

| Superfície    | Quando usar                               | Ordem                                                     |
| ------------- | ----------------------------------------- | --------------------------------------------------------- |
| `API_ONLY`    | Somente backend/runtime API mudou         | API até `KEEP`                                            |
| `WEB_ONLY`    | A API já é compatível e somente Web mudou | Web até `KEEP`                                            |
| `API_AND_WEB` | A feature atravessa os dois repositórios  | API backward-compatible até `KEEP`, depois Web até `KEEP` |

Não faça deploy simultâneo. Necessidade real de atomicidade cross-repo exige
nova decisão arquitetural.

## Classifique migrations da API

| Level | Condição                                        | Procedimento                                                                                                                                                                   |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `pending=[]`                                    | CI/candidate/classification → preflight → Gate Production → pointer → API-only recreate → health/smoke → T+0/T+30/T+120                                                        |
| 2     | pending exato aprovado como backward-compatible | CI/candidate/classification → preflight → Gate Production → checkpoint → migration one-shot → inventário exato → candidate → API-only recreate → health/smoke → T+0/T+60/T+300 |
| 3     | destrutiva, incompatível ou fora do contrato    | `STOP`; arquitetura própria                                                                                                                                                    |

Level 2 pode voltar a aplicação para a previous image, mas não executa
`migration:revert`. ADR-020 e `docker/production/deploy-api-simple.py`
continuam autoridades do fluxo API.

## Checklist da release

1. O que será deployado e qual é a superfície?
2. Há migration? Qual Level e qual pending exato?
3. Quais são os candidate SHAs/digests/deployments imutáveis?
4. Quais são as versões previous factuais?
5. A CI pertence aos candidates exatos?
6. Quais sinais compõem o Production Health?
7. O risco exige validação automatizada adicional ou observação longa? Qual?
8. O Gate de Production vincula todas as identidades exatas?
9. Quais falhas acionam rollback?
10. Quem fará a Manual Product Acceptance e registrará `APPROVE` ou `REJECT`?

## Rotina Web

Antes da promotion:

- confirme `git.deploymentEnabled=false`; merge continua diferente de deploy;
- identifique candidate imutável e `PREVIOUS_WEB_DEPLOYMENT`;
- comprove mesmo projeto, estado `READY` e elegibilidade de ambos;
- valide o generated host sem credenciais;
- classifique se o risco exige browser, feature smoke ou observação longa e,
  somente quando exigir, congele o menor comando e os checkpoints necessários;
- obtenha Gate de Production vinculado às identidades exatas.

Depois de uma única promotion manual:

1. comprove o Production Health: deployment `READY`, candidate/source correto,
   custom domain correto, Web pública HTTP 200 e API health HTTP 200;
2. execute somente a validação automatizada adicional e os checkpoints
   declarados pelo risco, quando existirem;
3. obtenha Manual Product Acceptance no domínio real;
4. com `APPROVE` e todos os gates aplicáveis aprovados, declare `KEEP`; com
   `REJECT` ou falha obrigatória, execute `ROLLBACK`.

### Ferramentas opcionais de validação

```text
npm run smoke:web:generated-host
npm run smoke:production:web
```

O harness permanece disponível para tarefas cujo risco exija browser ou
mutation automatizada. Sua existência não o torna gate universal. Ele possui
exatamente três perfis:

| Perfil               | Alvo e permissão                                                            |
| -------------------- | --------------------------------------------------------------------------- |
| `generated-host`     | valida fail-closed do host gerado, sem credenciais                          |
| `production-core`    | valida autenticação, Organization e shell; não autoriza mutation de negócio |
| `production-feature` | autoriza somente feature e mutations declaradas no binding                  |

`smoke:web:generated-host` exige
`GENESIS_VERCEL_GENERATED_URL=https://<candidate>.vercel.app`. Ele nunca
envia credenciais e aceita somente application 4xx fail-closed ou Vercel
Deployment Protection comprovada; redirect 3xx genérico falha.

`smoke:production:web` usa por padrão
`https://app.agenciagenesismkt.com.br` e `/app`. Os parâmetros
`GENESIS_HARNESS_TARGET`, `GENESIS_HARNESS_BASE_URL` e
`GENESIS_SMOKE_ROUTE` permitem qualificação controlada sem codificar candidate.
Credenciais sintéticas entram somente por
`GENESIS_SMOKE_EMAIL`/`GENESIS_SMOKE_PASSWORD` ou pelo runtime secret já
existente na VPS; nunca são registradas. Screenshot, trace e video permanecem
desligados.

Os perfis `production-core` e `production-feature` exigem o binding
operacional não secreto em
`/opt/genesis/shared/config/smoke-profile.v1.json`. Para simulação controlada
em CI, o mesmo JSON pode entrar por `GENESIS_SMOKE_PROFILE_JSON`. O schema é
estrito e aceita somente `schemaVersion`, `profileId`, `principalUserId`,
`principalEmail`, `organizationId`, `organizationName`, `requiredRole`,
`allowedFeatures`, `allowedMutations` e `dataPrefix`. Ele não contém senha,
token ou cookie; a senha permanece no secret de credenciais existente.

Antes de qualquer mutation, o perfil de feature comprova o e-mail da
credencial, o ID e e-mail do usuário autenticado, uma única Organization, ID e
nome exatos, role `owner`, feature e mutations permitidas. Campo ausente,
campo extra, divergência ou duas Organizations encerram o smoke antes da
mutation. A seleção visual usa o nome exato do binding e nunca depende da
primeira opção.

Quando exigido pelo risco, o core prova app, login, seleção real de Organization
quando necessária, shell protegido, API same-origin, ausência de fatal browser
error e HTTP 5xx, e logout. Ele não contém assertions de uma feature.

### Automated Feature Validation

Automated Feature Validation não é gate padrão de uma mudança Web normal,
reversível e de baixo risco. Ela é declarada antes da promotion somente quando
o risco justificar, por exemplo:

- autenticação, autorização, sessão, tenant ou privilégios;
- fluxo financeiro ou operação destrutiva/irreversível;
- migration, transformação de dados ou integração externa crítica;
- proxy, DNS, runtime ou infraestrutura de deployment;
- falha silenciosa difícil de detectar manualmente.

Mesmo nesses casos, use o menor teste capaz de cobrir o risco. Quando uma
validação automatizada adicional for exigida, declare:

- nome e routes;
- risco coberto e assertions;
- comando exato, que pode ou não usar Playwright;
- checkpoints adicionais necessários.

Target e validação são dimensões independentes.
`GENESIS_REQUIRE_FEATURE_SMOKE=true` permanece verdadeiro tanto em
`local` quanto em `production` quando a tarefa exigir feature smoke; nunca
derive a obrigatoriedade do target. O spec versionado de Presentation V2 é
apenas um exemplo separado:

```text
npm run smoke:web:feature:presentation-v2
```

Tarefas de risco que exijam nova feature validation fornecem seu próprio
spec/comando no Task Packet. Não edite o harness depois da promotion.

O smoke `PIPE-V2-03A` deriva nome e telefone sintéticos de
`PIPE-V2-03A + Web functional integrated SHA`, usa o prefixo
`[GENESIS-SMOKE]`, captura o UUID do Lead na URL criada e localiza esse UUID no
Pipeline. Antes da mutation em Production, uma busca exata deve provar que a
identidade da release ainda não existe. Um Lead preexistente encerra a
execução; o harness não apaga dados e não reutiliza fixture ou ordem visual.

Quando browser core ou feature smoke forem exigidos, o binding precisa ser
provisionado e validado antes do Gate de Production. Na ausência do arquivo ou
de correspondência factual do principal e da Organization, registre
`PRODUCTION_BINDING_READY=false`; o browser core e toda mutation automatizada
permanecem bloqueados.

## Rollback Web

Se qualquer gate obrigatório falhar após promotion:

`PREVIOUS_WEB_DEPLOYMENT → promote → Production Health → STOP`

Não ajuste Production, não tente a feature novamente e não faça uma segunda
promotion automática do candidate.

## Observação

Para uma feature Web normal, confirme o Production Health imediatamente depois
da promotion. `T+30`, `T+120`, browser e observações adicionais entram somente
quando o risco da tarefa os justificar. Para API, preserve os sinais e tempos
do ADR-020 em `T+0/T+30/T+120` no Level 1 e `T+0/T+60/T+300` no Level 2.

## Resultado

- `KEEP`: Production Health, Manual Product Acceptance e qualquer validação
  adicional exigida pelo risco passaram.
- `ROLLBACK`: previous foi restaurado após falha pós-promotion.
- `STOP`: identidade, preflight, autorização, validação ou rollback não pôde
  ser comprovado.
