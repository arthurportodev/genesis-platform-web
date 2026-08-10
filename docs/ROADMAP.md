<!-- genesis-memory-history:v1 -->

# Roadmap — snapshot histórico/superseded

Todo o conteúdo abaixo é um snapshot histórico/superseded do planejamento Web
anterior. Ele é preservado para rastreabilidade, não descreve o trabalho
vigente e nunca deve ser usado como fallback. O estado e a ação canônicos são
resolvidos pela memória da API através do pointer Web.

Estados: ✅ Concluído · 🚧 Em andamento · ⬜ Planejado · ⏸ Adiado

## 0.7 — Frontend operacional ✅

- ✅ `0.7.1.1` — Bootstrap do Repositório Frontend (PR #1, squash
  `30b91272088dd9be03b8bd9feffbf74dac48acc7`).
- ✅ `0.7.1.2` — Sessão Web, Organization Ativa e HTTP (PR #2, squash
  `633ace9b55ec25e70f1f88089865f89db464ed5f`).
- ✅ `0.7.2` — Inbox e Detalhe (PR #3, squash
  `859823501bbdee03441a9fa865d823f3890be07a`).
- ✅ `0.7.3` — Pipeline Kanban (PR #4, squash
  `1040523fa4b415e1cdf25d7f61085c3765f33eb9`).
- ✅ `0.7.4` — Follow-up e Filas Operacionais (PR #5, squash
  `f9fc37dd31fa2116a66354d46938c60d566fe101`).
- ✅ `0.7.5` — Métricas Operacionais (PR #6, squash
  `1ac7e26cda535cbf3e5c02dd78da4e0fb95a2e9e`).
- ✅ `0.7.6` — Criação Manual de Leads (PR #7, squash
  `4e4f8db0fcd31a4280d72f8cba0a1e0b47f4fa92`).

O ciclo funcional existente é: criar Lead → Inbox → detalhe → Pipeline →
Follow-up → métricas. Importação, formulário público conectado, comunicação,
WhatsApp, automações, calendário, estágios customizáveis e drag-and-drop não
estão disponíveis e não são compromissos automáticos.

## 0.8 — Infraestrutura e produção 🚧

- ✅ `0.8.0` — Arquitetura e Plano de Produção: Gate 1 técnico read-only; as
  decisões humanas foram aprovadas em 30 de julho de 2026.
- ✅ `0.8.1` — Reconciliação Canônica da Documentação, incorporada no frontend
  pelo PR #8, squash `bfe7c81fca34f723677e2fe5097598d92f487838`.
- ✅ `0.8.1.1` — Portabilidade e paridade frontend do Sistema Operacional de
  Desenvolvimento V2, incorporada pelo PR #9 no squash
  `890a49fb62fd194f8c2adf04fbfeb0cdd84e32bf`; backend canônico no squash
  `27d85416507ae4d8391d74b4181f8400c6d61301` e paridade 9/9 confirmada.
- ⬜ `0.8.2` — Hardening e Imagem de Produção da API.
- ⬜ `0.8.3` — PostgreSQL, Roles, Migrations e Restore.
- ⬜ `0.8.4` — Stack da API na Hetzner.
- ⬜ `0.8.5` — Origem, Traefik, TLS e Firewall.
- ⬜ `0.8.6` — Proxy e Segurança do Frontend.
- ⬜ `0.8.7` — Projeto Vercel.
- ⬜ `0.8.8` — Domínio e DNS do App.
- ⬜ `0.8.9` — Observabilidade, Backup e Runbooks.
- ⬜ `0.8.10` — Bootstrap Seguro.
- ⬜ `0.8.11` — Smoke e Abertura Controlada.

No snapshot, a sequência apontava `0.8.2` como item seguinte. Essa indicação foi
superseded pela autoridade temporal da API.

À época, este repositório detalhava `0.8.6`–`0.8.8` no que se referia a Vercel,
proxy same-origin, Preview, cookies e segurança web. A decisão arquitetural
permanece nos documentos estáveis, mas a sequência de tarefas não é vigente.

Previews permanecem fail-closed e nunca acessam a API de produção. Billing
permanece adiado, sem escopo aprovado.
