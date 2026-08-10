# Visão do projeto

A Genesis Platform Web é a interface administrativa da operação comercial. O
frontend oficial consome o backend `arthurportodev/genesis-platform-api` sem
duplicar autorização, regras tenant ou decisões de negócio.

## Stack oficial

- React 19, Vite 8 e TypeScript estrito.
- TanStack Router e TanStack Query.
- Tailwind CSS e componentes locais no padrão shadcn/ui.
- React Hook Form e Zod.
- Vitest, Testing Library, MSW e Playwright.

## Escopo implementado

- Sessão web real, access somente em memória, refresh cookie-only, CSRF e
  coordenação segura entre abas.
- Bootstrap, seleção e troca de Organization ativa, guards e cache
  tenant-scoped.
- Cliente HTTP same-origin em `/api/v1`, proxy Vite local e falha fechada sem
  target.
- Inbox, detalhe, Pipeline, Follow-up, filas operacionais e métricas de Leads.
- Criação manual server-confirmed de Leads para owner, admin e member.
- Shell administrativo responsivo, estados operacionais, testes e CI.

O ciclo funcional implementado é: criar Lead → Inbox → detalhe → Pipeline →
Follow-up → métricas.

## Limites estruturais

A arquitetura de publicação aceita usa Vercel e proxy same-origin. Preview é
fail-closed e nunca recebe acesso à API de produção. Status operacional,
publicação e autorização de dados reais pertencem à memória canônica da API,
não a esta visão de produto.

Importação de Leads, formulário público conectado, comunicação externa,
WhatsApp, automações, calendário, estágios customizáveis e drag-and-drop
continuam indisponíveis e não constituem compromissos automáticos de produto.

## Destinos aprovados

- Aplicação: Vercel, com hostname final governado pela autoridade operacional.
- Navegador: somente paths relativos `/api/v1`.
- Origem: server-only, HTTPS e protegida contra bypass.
- Backend e plano geral: `arthurportodev/genesis-platform-api`.
- Preview: interface fail-closed, sem API de produção.

Consulte [PRODUCTION.md](PRODUCTION.md) para o contrato estável do frontend e o
[pointer](memory/project-state.pointer.v1.json) para estado e sequência
operacional.
