# Runbook de deployment

Este runbook aplica o menor sistema seguro. Ele referencia o deploy simples da
API definido pelo ADR-020 no repositório
`arthurportodev/genesis-platform-api` e o fluxo manual Vercel deste
repositório. Não cria plataforma, staging, transação distribuída ou autorização
de Production.

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
6. Qual é o core smoke?
7. Qual feature smoke foi congelada e ela é obrigatória em Production?
8. O Gate de Production vincula todas as identidades exatas?
9. Quais falhas acionam rollback?
10. Quais observações precisam passar antes de `KEEP`?

## Rotina Web

Antes da promotion:

- confirme `git.deploymentEnabled=false`; merge continua diferente de deploy;
- identifique candidate imutável e `PREVIOUS_WEB_DEPLOYMENT`;
- comprove mesmo projeto, estado `READY` e elegibilidade de ambos;
- valide o generated host sem credenciais;
- qualifique em ambiente controlado o core e o comando exato da feature;
- congele no Task Packet os comandos e se a feature é obrigatória;
- obtenha Gate de Production vinculado às identidades exatas.

Depois de uma única promotion manual:

1. execute o core browser smoke no domínio customizado;
2. execute exatamente a feature smoke congelada quando obrigatória;
3. observe T+0, T+30 e T+120;
4. declare `KEEP` somente com todos os gates obrigatórios aprovados.

### Comandos duráveis

```text
npm run smoke:web:generated-host
npm run smoke:production:web
```

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

O core prova app, login quando necessário, seleção real de Organization quando
necessária, shell protegido, API same-origin, ausência de fatal browser error e
HTTP 5xx, e logout. Ele não contém assertions de uma feature.

### Feature smoke

Uma mudança funcional Web declara antes da promotion:

- nome e routes;
- comportamento crítico e assertions;
- comando Playwright exato;
- obrigatoriedade em Production.

Target e validação são dimensões independentes.
`GENESIS_REQUIRE_FEATURE_SMOKE=true` permanece verdadeiro tanto em
`local` quanto em `production`; nunca derive a obrigatoriedade do target. O
spec versionado de Presentation V2 é apenas um exemplo separado:

```text
npm run smoke:web:feature:presentation-v2
```

Futuras features fornecem seu próprio spec/comando no Task Packet. Não edite o
harness depois da promotion.

## Rollback Web

Se qualquer gate obrigatório falhar após promotion:

`PREVIOUS_WEB_DEPLOYMENT → promote → compatibility core smoke → STOP`

Não ajuste Production, não tente a feature novamente e não faça uma segunda
promotion automática do candidate.

## Observação

Em cada ponto Web (`T+0/T+30/T+120`), confirme deployment `READY`, custom
domain, core smoke/proxy, API health, zero HTTP 5xx e nenhum fatal browser
error. Para API, preserve os sinais do ADR-020 em `T+0/T+30/T+120` no Level 1
e `T+0/T+60/T+300` no Level 2.

## Resultado

- `KEEP`: todos os gates, smokes obrigatórios e observações passaram.
- `ROLLBACK`: previous foi restaurado após falha pós-promotion.
- `STOP`: identidade, preflight, autorização, validação ou rollback não pôde
  ser comprovado.
