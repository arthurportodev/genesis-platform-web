# Segurança

## Fronteiras atuais da 0.7.1.1

Este frontend não autentica usuários, não recebe tokens, não mantém sessão e não
consulta a API. A tela de login valida formato apenas no navegador e descarta os
valores; não representa nem simula autenticação.

## Regras permanentes

- Nunca versionar `.env`, tokens, cookies, credenciais ou dados de clientes.
- Nunca guardar tokens em `localStorage`, `sessionStorage` ou IndexedDB.
- Não registrar credenciais, PII, tokens ou respostas completas de API.
- Não inventar permissões nem confiar em ocultação visual como autorização.
- Variáveis `VITE_*` são públicas no bundle e não podem conter segredos.
- Dependências novas exigem origem, versão, lockfile e auditoria revisados.
- Redirecionamentos internos precisam ser validados antes de navegar.
- HTML de terceiros não deve ser renderizado sem sanitização e contrato explícito.

## Contrato futuro aprovado para a 0.7.1.2

Os controles abaixo pertencem à tarefa `0.7.1.2` e ainda não foram implementados:

- access token somente em memória;
- refresh token exclusivamente em cookie `HttpOnly` controlado pela API;
- proteção CSRF cookie-to-header e validação de `Origin` pela API;
- nenhum token em `localStorage`, `sessionStorage` ou IndexedDB;
- bootstrap autenticado de usuário e Organizations;
- `X-Organization-Id` em requests tenant-scoped;
- backend como autoridade sobre Membership e papel;
- cache sempre segmentado por `organizationId`, com limpeza e cancelamento de
  dados ao trocar de Organization;
- refresh single-flight dentro da aba, coordenação entre abas e propagação de
  logout entre abas;
- tratamento seguro da rotação de refresh;
- controle de concorrência com `ETag` e `If-Match`;
- idempotência com `Idempotency-Key`;
- redirecionamentos internos validados;
- nenhuma PII ou token em logs.

O risco residual de refresh concorrente entre abas será tratado no frontend
futuro. A reuse detection do backend continua sendo uma garantia obrigatória e
não será enfraquecida pela coordenação cliente.

O acesso futuro do navegador à API deve preferir path same-origin/proxy da
Vercel, sujeito ao Gate 1 da `0.7.1.2`. Proxy, API, Vercel, domínio e ambientes
publicados ainda não estão configurados.

## Incidentes

Interrompa a tarefa ao encontrar segredo, exposição de dados ou comportamento de
sessão não aprovado. Preserve evidências sem reproduzir valores sensíveis e
reporte pelo canal privado definido pela equipe.
