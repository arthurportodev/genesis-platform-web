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

Esse ciclo funcional foi concluído na Fase `0.7`: criar Lead → Inbox → detalhe
→ Pipeline → Follow-up → métricas.

## Estado atual e limites

A Fase `0.8` é a fase atual e prepara a primeira produção. A arquitetura Vercel
com proxy same-origin foi aceita, mas ainda não foi implementada. Não existem
projeto Vercel, domínio, DNS, proxy de produção, deploy, staging ou acesso de
Preview à API. O frontend não está pronto para dados reais.

Importação de Leads, formulário público conectado, comunicação externa,
WhatsApp, automações, calendário, estágios customizáveis e drag-and-drop
continuam indisponíveis e não constituem compromissos automáticos de produto.

## Destinos aprovados

- Aplicação: `app.agenciagenesis.com.br` na Vercel.
- Navegador: somente paths relativos `/api/v1`.
- Origem server-only: `origin-api.agenciagenesis.com.br`.
- Backend e plano geral: `arthurportodev/genesis-platform-api`.
- Preview: interface fail-closed, sem API de produção.

Consulte [PRODUCTION.md](PRODUCTION.md) para o plano específico do frontend e
o documento homônimo do backend para a arquitetura geral e o DAG da Fase
`0.8`.
