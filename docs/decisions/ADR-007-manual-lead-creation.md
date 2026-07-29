# ADR-007 — Criação Manual de Leads

- Estado: Proposta no candidato `0.7.6`
- Data: 2026-07-29

## Contexto

Inbox, detalhe, Pipeline, Follow-up e Metrics já permitem operar Leads que
existem. O backend canônico também oferece `POST /api/v1/leads`, cuja
deduplicação por Organization e telefone normalizado pode criar um Lead, agregar
uma LeadEntry a um Lead existente ou ocultar o resultado de member. O frontend
precisa consumir essas semânticas sem antecipá-las, persistir PII ou inventar
consulta de idempotência.

## Decisão

- A criação ocupa a página `/app/leads/new`, com entrada `Novo Lead` somente no
  cabeçalho da Inbox. Owner, admin e member podem acessar; não há modal grande,
  botão global, criação no Pipeline ou no Follow-up.
- React Hook Form e Zod produzem somente os campos aceitos. O formulário agrupa
  identificação, origem, atribuição e UTMs secundárias, omite opcionais vazios,
  exige `sourceDetail` apenas para `other` e o limpa ao mudar a origem.
- O telefone usa `type="tel"` e `inputmode="tel"`. Uma máscara brasileira
  não destrutiva pode ser aplicada no blur, mas valores com `+` são preservados.
  O backend continua autoridade de validade, normalização E.164 e deduplicação
  por Organization + telefone; e-mail nunca é tratado como chave.
- Owner/admin consultam Memberships ativas e podem escolher `Sem responsável`.
  Member não monta essa query, não vê o seletor e nunca envia
  `responsibleMembershipId`. Capabilities frontend são apenas UX.
- A operação usa o cliente HTTP central com Bearer, `X-Organization-Id`, JSON e
  `Idempotency-Key` UUID v4. Não envia `If-Match`, não chama `fetch` no
  componente e não faz atualização otimista.
- `201` e `200` exigem `LeadView` e ETag recebidos. `201` exige ainda o
  `Location` contratual, mas o ID usado vem exclusivamente do body. `201`
  anuncia Lead criado; `200` anuncia nova entrada no Lead existente; replay
  identificado anuncia resultado confirmado. O detalhe é carregado pelo GET
  oficial após navegação.
- `204` é resultado opaco de member: nenhum body, ETag, Location ou ID é
  inferido. O fluxo retorna à Inbox e anuncia somente que a solicitação foi
  processada.
- Cada nova intenção vincula Organization, Membership do ator, payload
  normalizado exato e uma chave UUID v4. Tudo fica somente em memória. Resultado
  determinístico encerra a intenção; transporte, timeout, protocolo ou erro de
  servidor com efeito remoto incerto preserva payload e chave.
- No estado `Resultado não confirmado`, o formulário fica bloqueado. `Tentar
confirmar` repete exatamente o mesmo POST com a mesma chave; `Abandonar
tentativa` descarta a intenção e alerta que uma nova tentativa pode registrar
  outra entrada se a anterior tiver sido aplicada. Não existe retry automático
  nem endpoint de consulta.
- Reload perde a intenção e a chave. O telefone ainda evita uma segunda linha de
  Lead, mas um novo envio pode agregar outra entrada ao Lead existente. Esse
  risco não justifica persistir PII ou chave em storage.
- Draft, payload e chave não entram em URL, localStorage, sessionStorage,
  BroadcastChannel, logs, telemetria, Query Cache ou cache persistido. A mutation
  usa `gcTime: 0`, é resetada ao encerrar o fluxo e não retém o payload como
  variável.
- Navegação interna usa blocker; fechamento/reload usa `beforeunload` somente
  quando sujo ou incerto. Troca de Organization exige confirmação e desmonta a
  instância vinculada ao tenant/ator. Logout descarta imediatamente sem bloquear
  a saída. Respostas tardias de uma instância desmontada são ignoradas.
- Todo sucesso invalida Inbox e Pipeline. `201` identificado também invalida
  Metrics, detalhe, timeline e Sem responsável quando aplicável. `200` invalida
  detalhe/timeline e somente filas indicadas pelo body; replay pode invalidar
  Metrics conservadoramente. `204` invalida Minhas ações, nunca Metrics ou
  queries administrativas. Não há invalidação global.
- Desktop usa largura controlada e até duas colunas; mobile usa uma coluna,
  scroll normal e alvos mínimos de 44 px. Labels, fieldsets, foco no primeiro
  erro, mensagens associadas, `aria-live`, teclado e reduced motion permanecem
  verificáveis.

## Consequências

O ciclo operacional começa no frontend sem duplicar autorização, normalização
ou deduplicação do backend. Resultado incerto exige decisão explícita e a
privacidade prevalece sobre continuidade após reload. Importação, formulário
público, landing pages, anúncios, WhatsApp, automações, Notes/Activities durante
criação, dependências novas, alteração backend, Vercel e deploy permanecem fora
do escopo.

## Fontes

- Backend `src/modules/leads/controllers/leads.controller.ts`.
- Backend `src/modules/leads/dto/lead.dto.ts`.
- Backend `src/modules/leads/services/leads.service.ts`.
- Backend canônico read-only no SHA
  `57f6955b3a90a29517d5477e75aac97032425ed1`.
