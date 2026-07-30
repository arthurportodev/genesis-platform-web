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

A incorporação deste conjunto documental conclui a tarefa 0.8.1.

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
- Estado: candidato local; publicação depende de autorização específica após
  validação Critical e verifier independente.
- Limites: produto, backend, infraestrutura, dependências, lockfile e produção
  não foram alterados.
