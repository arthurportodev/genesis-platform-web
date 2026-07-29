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
- Estado: candidato local em validação para Gate 2, sem PR ou entrega remota.
- Base frontend: `633ace9b55ec25e70f1f88089865f89db464ed5f`.
- Backend canônico read-only:
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
- Entrega: Inbox real, filtros e cursor; detalhe, timeline ASC, próxima ação,
  ciclos, diretório condicionado ao papel e mutações protegidas por versão e
  idempotência.
- Limites: sem criação de Lead, Pipeline, filas globais, métricas, mudança no
  backend, dependências, Vercel, domínio ou deploy.
