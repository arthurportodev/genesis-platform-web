# ADR-005 — Follow-up e filas operacionais de Leads

- Estado: Incorporada pelo PR #5, squash
  `f9fc37dd31fa2116a66354d46938c60d566fe101`
- Data: 2026-07-29

## Contexto

Inbox e Pipeline respondem quais Leads existem e em qual etapa estão. A operação
diária também precisa saber o que exige ação agora, sem criar um sistema de
tarefas paralelo nem duplicar o domínio de Leads.

O backend já oferece as filas `work/my-actions`, `work/unassigned` e
`work/return-reviews`, além dos comandos condicionais para Next Action,
assignment e dismiss. As filas contêm revisões, mas não fornecem ETag.

## Decisão

- `/app/follow-up` permanece no domínio `features/leads` e apresenta tabs
  Minhas ações, Sem responsável e Retornos para revisão. As duas últimas são
  exclusivas para owner/admin.
- Minhas ações inicia em Atrasadas e possui segmentos Atrasadas, Hoje e Futuras.
  Somente a tab e o segmento ativos consultam o backend; não há prefetch para
  badges, polling ou opção Todas na interface.
- Cada fila usa infinite query tenant-scoped, cursor opaco como `pageParam` e
  botão Carregar mais. Duplicidades preservam a maior revisão, sem recalcular o
  total do backend.
- `temporalState` e `page.asOf`, calculados no timezone CRM do backend, são as
  autoridades temporais. O navegador não reclassifica atraso, hoje ou futuro.
- O adapter converte a resposta em modelo especializado antes do Query Cache da
  fila e descarta telefone e e-mail. Nenhum dado de Lead vai para storage, URL,
  logs ou BroadcastChannel.
- Abrir detalhe está sempre disponível. Complete, reschedule e cancel são ações
  rápidas de Minhas ações; assignment pertence a Sem responsável; dismiss
  pertence a Retornos. Edição, lifecycle amplo, Notes, Activities e criação de
  Next Action permanecem no detalhe.
- Toda ação rápida faz preflight com snapshot de detalhe exatamente compatível
  ou novo GET. Somente o ETag opaco retornado pelo detalhe é aceito; revisões
  numéricas jamais constroem ETag.
- Complete, reschedule, cancel e dismiss vinculam a chave aleatória à
  Organization, ator, Lead, revisão/ETag, recurso relacionado e payload
  normalizado. Resultado remoto incerto preserva a intenção exata para retry,
  verificação ou abandono. `409/412` não têm retry automático.
- Assignment usa `If-Match`, mas não Idempotency-Key. Resultado incerto permite
  somente verificar o estado antes de nova decisão; replay cego é proibido.
- Sucesso é server-confirmed e invalida apenas filas e recursos afetados.
- Estado de tab, filtros, origem e retorno ao detalhe permanece em memória e é
  descartado em reload, troca de Organization, logout ou expiração.
- Capabilities melhoram a UX, incluindo dismiss apenas para owner/admin, Lead
  encerrado e retorno pendente. O backend continua sendo a autoridade.
- Desktop usa lista operacional densa; mobile usa cards, Sheet e menus com os
  mesmos contratos. Foco e anúncios são restaurados quando um item desaparece.
- Nenhuma dependência foi adicionada.

## Consequências

A operação passa a priorizar trabalho por vencimento, atribuição e retorno sem
persistir PII ou enfraquecer concorrência. Preflight pode adicionar uma leitura
de detalhe; essa leitura é necessária porque itens de fila não fornecem ETag.
Uma tela continuamente em foco pode envelhecer na virada do dia até refresh
manual, risco aceito para evitar polling e autoridade temporal local.

Métricas foram tratadas posteriormente pelo ADR-006. Calendário, WhatsApp,
automações, comunicação, Vercel e deploy permanecem fora do escopo.

## Fontes

- Backend `src/modules/leads/controllers/leads.controller.ts`.
- Backend `src/modules/leads/dto/lead.dto.ts`.
- Backend `src/modules/leads/services/lead-operational-read.service.ts`.
- Backend `src/modules/leads/types/lead-api.type.ts`.
- Backend canônico read-only no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
