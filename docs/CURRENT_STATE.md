# Estado atual

Atualizado para a tarefa `0.7.1.1`.

## Disponível

- Projeto React/Vite/TypeScript com Node 24.
- Tema claro, tokens semânticos e componentes compartilhados.
- Rotas públicas, shell administrativo e navegação móvel.
- TanStack Query configurado, sem consultas remotas.
- Formulário de login validado localmente, sem envio de credenciais.
- Testes unitários, de integração, ferramentas de tarefa e smoke E2E.
- CI `Validate frontend` e rewrite SPA para Vercel.

## Não disponível

- Sessão, login real, cookies e refresh de autenticação.
- Contexto e seleção real de organização.
- Integração com endpoints do backend.
- Dados, mutações, permissões e métricas reais.
- Projeto remoto ou deploy na Vercel.
- Domínio `app.agenciagenesis.com.br`, DNS ou proxy same-origin configurados.

Qualquer tarefa que cruze uma dessas fronteiras deve partir de contrato aprovado,
sem inferir comportamento a partir das telas de fundação.

A integração com `arthurportodev/genesis-platform-api` pertence à `0.7.1.2` e
depende de Gate 1. Vercel e o domínio são apenas destinos planejados.
