# Arquitetura

## Camadas

- `src/app`: inicialização, provedores, estilos e árvore de rotas; compõe a
  aplicação e não é dependência de `features` ou `shared`.
- `src/features`: páginas e comportamento agrupados por capacidade de produto.
- `src/shared`: componentes, configuração pública reutilizável, primitivas
  visuais e utilitários sem regra de domínio.
- `src/test`: configuração e infraestrutura compartilhada de testes.
- `test/e2e`: cenários executados contra o build de produção.
- `scripts`: governança de escopo, preflight, validação e fingerprint.

Dependências apontam de `app` para `features` e `shared`, e de `features` para
`shared`. `features` e `shared` nunca dependem de `app`; `shared` também não
depende de `features`. A configuração de ambiente reutilizável possui fonte única
em `src/shared/config`.

## Execução

`main.tsx` monta uma única raiz React. `AppProviders` cria uma instância estável de
`QueryClient`; o router baseado em código seleciona a página e o shell. Um
`ErrorBoundary` no topo impede que falhas de renderização deixem uma tela vazia.

## Rotas

- Públicas: `/login`, `/select-organization`, `/access-denied`.
- Administrativas: `/app`, `/app/leads`, `/app/leads/:leadId`, `/app/pipeline`,
  `/app/follow-up`, `/app/metrics`, `/app/settings`.
- Qualquer endereço desconhecido usa a página 404.

As rotas administrativas não possuem guarda ainda. A existência do shell não
representa autorização; a integração de sessão definirá esse limite no futuro.

## Dados e estado

TanStack Query é o mecanismo reservado para estado assíncrono do servidor. Não há
cliente HTTP nem chamadas remotas nesta etapa. Estado local é usado apenas para
interações efêmeras de interface, nunca para simular sessão ou dados de domínio.

## Topologia planejada

O frontend permanece uma SPA sem SSR ou server functions. A Vercel é o destino
planejado em `app.agenciagenesis.com.br`; o backend NestJS oficial permanece em
`arthurportodev/genesis-platform-api`. A integração do navegador pertence à
`0.7.1.2` e deve avaliar path same-origin/proxy no Gate 1. Vercel, domínio, DNS,
proxy e API ainda não estão conectados.
