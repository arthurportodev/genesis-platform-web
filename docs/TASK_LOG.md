# Registro de tarefas

## 0.7.1.1 — Bootstrap do Repositório Frontend

- Classe: Critical.
- Estado: incorporada na `main` pelo PR #1, squash
  `30b91272088dd9be03b8bd9feffbf74dac48acc7`.
- Base: `42e49ee934990d44c6ccacc61a299434db33930e`.
- Entrega: stack oficial, arquitetura, rotas, shell, estados operacionais, testes,
  ferramentas de tarefa, documentação, CI e configuração SPA.
- Limites preservados: sem autenticação, API, dados fictícios, alterações no
  backend ou operações remotas de deploy.
- Fonte de contrato backend lida em modo somente leitura:
  `docs/decisions/ADR-010-web-session-contract.md` no SHA
  `8b299a95993bddd3425b5043aaa40fa2eb15edab`.
- Rodada pós-verificação: CI sem publicação de artefatos, classes e perfis
  separados, Gates completos, ADR e segurança ampliados, marca textual, tokens
  centralizados, seletor de empresa acessível e cobertura Vitest/Playwright
  reforçada; sem dependências ou expansão funcional.

## 0.7.1.2 — Sessão Web, Organization Ativa e Integração HTTP

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #2, squash
  `633ace9b55ec25e70f1f88089865f89db464ed5f`.
- Base frontend: `30b91272088dd9be03b8bd9feffbf74dac48acc7`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: transporte HTTP, sessão em memória, refresh cookie-only, CSRF,
  coordenação multiaba, bootstrap, Organization ativa, cache tenant, guards,
  logout, ETag/idempotência, testes e documentação.
- Limites: backend e dependências inalterados; sem CRM real, Vercel, domínio,
  deploy ou persistência de token.

## 0.7.2 — Inbox e Detalhe do Lead

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #3, squash
  `859823501bbdee03441a9fa865d823f3890be07a`.
- Base frontend: `633ace9b55ec25e70f1f88089865f89db464ed5f`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: Inbox real, filtros e cursor; detalhe, timeline ASC, próxima ação,
  ciclos, diretório condicionado ao papel e mutações protegidas por versão e
  idempotência.
- Limites: sem criação de Lead, Pipeline, filas globais, métricas, mudança no
  backend, dependências, Vercel, domínio ou deploy.

## 0.7.3 — Pipeline Kanban de Leads

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #4, squash
  `1040523fa4b415e1cdf25d7f61085c3765f33eb9`.
- Base frontend: `859823501bbdee03441a9fa865d823f3890be07a`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: cinco colunas canônicas, filtros, paginação independente, cards com
  PII minimizada, desktop/mobile e movimento server-confirmed com preflight de
  ETag opaco, If-Match, Idempotency-Key e tratamento explícito de incerteza e
  conflitos.
- Limites: sem drag-and-drop, criação de Lead, estágios customizáveis, filas
  globais, métricas, mudança no backend, dependências, Vercel ou deploy.

## 0.7.4 — Follow-up e Filas Operacionais

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #5, squash
  `f9fc37dd31fa2116a66354d46938c60d566fe101`.
- Base frontend: `1040523fa4b415e1cdf25d7f61085c3765f33eb9`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: filas Minhas ações, Sem responsável e Retornos para revisão; tabs por
  papel, paginação incremental, PII minimizada, navegação transitória e ações
  rápidas server-confirmed com ETag, idempotência contextual e incerteza segura.
- Limites: sem métricas, calendário, comunicação, automações, polling, mudança
  no backend, dependências, Vercel ou deploy.

## 0.7.5 — Métricas Operacionais de Leads

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #6, squash
  `1ac7e26cda535cbf3e5c02dd78da4e0fb95a2e9e`.
- Base frontend: `f9fc37dd31fa2116a66354d46938c60d566fe101`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: `/app/metrics` para owner/admin, resumo oficial tenant-scoped,
  snapshot atual, período civil default/customizado, presets e URL, sources,
  taxa limitada a ciclos decididos, refresh sem polling, desktop/mobile,
  acessibilidade e invalidações específicas.
- Limites: backend e dependências inalterados; sem Overview com métricas,
  conversão de Leads, tracking, BI, anúncios, Vercel ou deploy.

## 0.7.6 — Criação Manual de Leads

- Classe/perfil: Critical / critical.
- Estado: incorporada na `main` pelo PR #7, squash
  `4e4f8db0fcd31a4280d72f8cba0a1e0b47f4fa92`.
- Base frontend: `1ac7e26cda535cbf3e5c02dd78da4e0fb95a2e9e`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: `/app/leads/new`, botão somente na Inbox, DTO exato, responsável por
  papel, respostas `200/201/204`, idempotência em memória, incerteza explícita,
  invalidações específicas, proteção de PII, desktop/mobile e acessibilidade.
- Limites: backend, dependências e lockfile inalterados; sem importação,
  formulário público, integrações externas, Vercel ou deploy.

## Fase 0.7 — Frontend operacional

**Concluída.** As tarefas `0.7.1.1`–`0.7.6` entregaram o ciclo criar Lead →
Inbox → detalhe → Pipeline → Follow-up → métricas. Importação, formulário
público conectado, comunicação externa, WhatsApp, automações, calendário,
estágios customizáveis, drag-and-drop e produção permanecem indisponíveis.

## 0.8.0 — Arquitetura e Plano de Produção

- Natureza: Gate 1 técnico e operacional, estritamente read-only.
- Resultado: Gate 1 recomendado com decisões humanas pendentes; as decisões
  foram aprovadas pelo Product Owner em 30 de julho de 2026.
- Evidências negativas: sem branch, alteração de arquivo, PR, build, migration,
  seed, mudança em Vercel/DNS/Hetzner ou deploy.
- Decisão: Vercel e `app.agenciagenesis.com.br`, com proxy server-side de
  `/api/v1` para a origem protegida
  `origin-api.agenciagenesis.com.br`; Preview fail-closed.

## 0.8.1 — Reconciliação Canônica da Documentação

- Classe/perfil: Normal / docs.
- Responsabilidade: frontend e backend, com um único builder e consistência
  entre os dois candidatos.
- Resultado esperado: documentos canônicos, decisões aceitas, Fase `0.7`
  encerrada e plano `0.8.1`–`0.8.11` coerente.
- Limites: exclusivamente documental; sem código, infraestrutura ou operação
  remota.

A tarefa foi incorporada no frontend pelo PR #8, squash
`bfe7c81fca34f723677e2fe5097598d92f487838`, e no backend pelo PR #25,
squash `6a1a5bafc14195cbd8cf6f8b85077a4e1081381c`.

## 0.8.1.1 — Sistema Operacional de Desenvolvimento V2

- Classe/perfil: Critical / critical.
- Autoridade: backend aprovado no commit
  `ad8e36772bed7910c2d484255ce2c806024ce04d`.
- Base frontend: `bfe7c81fca34f723677e2fe5097598d92f487838`.
- Escopo: contratos compartilhados byte a byte, upstream e hashes de paridade,
  Task Manifest dual-read V1/V2, fingerprints V2, candidate ID, Skills,
  schemas, checks locais/CI e documentação.
- Adaptação frontend: TypeScript, Vitest e Playwright substituem os comandos
  específicos de NestJS, Jest, banco e Docker.
- Estado: incorporada serialmente no backend pelo PR #26, squash
  `27d85416507ae4d8391d74b4181f8400c6d61301`, e no frontend pelo PR #9,
  squash `890a49fb62fd194f8c2adf04fbfeb0cdd84e32bf`.
- CIs pós-merge: backend `30567270626` e frontend `30567803632`, ambas
  aprovadas sem checks pendentes.
- Paridade final: nove contratos compartilhados byte a byte equivalentes entre
  a árvore backend incorporada e o frontend.
- Findings: F-001 a F-008 resolvidos, sem findings novos ou limitações.
- Próxima tarefa: `0.8.2` — Hardening e Imagem de Produção da API, ainda não
  iniciada e sob autoridade do backend.
- Limites: produto, backend, infraestrutura, dependências, lockfile e produção
  não foram alterados.

## GH-01 Phase A — Web Satellite Candidate

- Classe/perfil: Critical / critical, com validação focal L0–L2 e verifier
  independente.
- Base Web: `1c2ba2af9306f13b9995b48619f4aafb682385cf`.
- Referência API read-only:
  `6c4bbb9b909dcd243f3e3d5165bf9368c3e16264`.
- Estado deste registro: candidato local para Gate 2; não incorporado e sem
  conclusão global da GH-01.
- Receipt: `GH-01-CROSS-REPO`, alvo `GH-01-COMPLETE`, proveniência
  `containing-commit`; o SHA final será conhecido somente após integração Web.
- Entrega candidata: pointer-only, bridge estável, schema protótipo, validator
  Node built-ins, testes herméticos, CI local e reconciliação das fontes Web.
- Onboarding controle: PASS em 3m36,9s, zero perguntas, reexplicações,
  intervenções humanas ou mutações; detectou corretamente o drift histórico do
  Web e usou a API como fonte temporal.
- Histórico superseded: referências anteriores à sequência `0.8.2`–`0.8.11`,
  ao host Hetzner e a hostnames fixos descrevem o snapshot da época e não são
  estado vigente.
- Janela de transição: a autoridade API não existe na base de referência;
  `AUTHORITY_UNAVAILABLE` e `MEMORY_TRANSITION_PENDING` são esperados sem
  fallback local até o Candidate B.
- Limites: API, produto, dependências, package/lockfile, infraestrutura,
  produção e Git/GitHub não foram alterados.

## 0.8-MVP-08 — Candidato API/Web para Gate de merge

Em 13 de agosto de 2026, Gate 1 autorizou o candidato local e CI não produtiva.
O Web candidato adiciona Function Node.js same-origin, Preview/hosts gerados
fail-closed, negação de fallback SPA em `/api/v1`, proveniência canônica do IP,
preservação HTTP, cookies host-only, `Location` relativa segura e no-store sem
CDN HIT. O lockfile foi normalizado e dois transitivos de tooling vulneráveis
foram atualizados dentro dos ranges existentes; a auditoria de produção passou
com zero findings.

Nenhum secret, Vercel, deploy, DNS, VPS, usuário ou dado real foi criado ou
alterado. Resultados finais, SHAs e PR pertencem ao checkpoint VERIFY.

## 0.8-MVP-08 — Remediação do runtime da Function Web

O baseline operacional `dpl_7rm5gaRDfvmVEDHjiJb9wFCF8jh9`, construído do
commit Web `b6aa5af91d78a998aceacbe963ef45649dd00149`, foi rejeitado porque a
Function emitida preservou um import ESM relativo sem extensão. Embora o módulo
`src/server/api-proxy.js` estivesse presente no pacote, Node.js 24 não resolveu
`../src/server/api-proxy` e encerrou com `ERR_MODULE_NOT_FOUND`.

A remediação mantém a arquitetura e o contrato HTTP intactos: corrige somente
o specifier para `.js` e adiciona uma regressão que compila, inspeciona,
inicializa e exercita o pacote fechado da Function. Production foi restaurada
ao deployment anterior; novo Preview e qualquer retomada operacional dependem
dos gates próprios desta subfase.

## 0.8-MVP-08 — Remediação da proveniência da Function Web

No baseline `33e99bfcfb87375a801ac49343c28a9fe76e2bb2`, o artefato Node.js 24
reproduziu o `404` do C2 antes do upstream: o rewrite apresentava o URL interno
da Function, embora `Host`, `X-Forwarded-Host` e `X-Forwarded-Proto`
identificassem a chamada HTTPS no domínio final. O gate comparava o hostname
interno de `request.url` com o hostname público.

A correção manteve rotas e arquitetura intactas e passou a exigir concordância
exata dos headers de host/protocolo da borda. Naquele checkpoint, a regressão
presumiu que `request.url` usava o pathname físico da Function e simulou a
reconstrução de path/query nessa forma. A seção seguinte registra a evidência
Vercel posterior que invalidou essa premissa e substituiu o teste falso
positivo. Nenhuma mudança de Production, DNS, VPS, API, banco ou segredo fez
parte daquele delta.

## 0.8-MVP-08 — Forense e remediação do roteamento da Function Web

O C3, construído do Web `d5c4f753e4d87c87dc1fe2c4dfa000ce946a7f2a`,
respondeu `404 API integration unavailable` antes do upstream. A regressão do
PR anterior era um falso positivo porque construía manualmente uma Request com
pathname físico `/api/proxy`. O roteador Vercel real preserva o pathname
público `/api/v1/...` e combina na query exatamente um capture reservado
`__genesis_proxy_path`, cujas barras chegam percent-encoded. O código anterior
rejeitava qualquer parâmetro reservado quando o pathname já era público; o
predicado exato foi `public_api_url_unresolved`.

A correção aceita somente essa forma observada: pathname público válido,
capture único e canônico, igualdade exata entre o capture decodificado e o
sufixo público e remoção exclusiva do parâmetro interno antes do upstream.
Ausência, duplicação, má-formação, divergência e acesso ao pathname físico
continuam fail-closed. A telemetria registra apenas enums e booleanos, sem URL,
query value, IP, cookie, token, body ou segredo. O Preview diagnóstico foi
excluído após a captura e não alterou Production, DNS, VPS, API ou banco.
