# Segurança

## Sessão web implementada

- Access token curto permanece somente em memória privada do coordenador.
- Refresh trafega exclusivamente no cookie `HttpOnly` do backend e nunca é
  lido, persistido ou enviado em body/header/query pelo frontend.
- Cookies CSRF reconhecidos possuem fonte única e são validados como base64url;
  duplicidade ou divergência body/cookie falha fechada.
- Login, refresh, logout e logout-all usam `X-CSRF-Token`, com uma única
  renovação após `403`. O frontend nunca define `Origin`.
- Web Locks serializam emissão de CSRF e rotação de refresh. Timeout não permite
  operação concorrente.
- BroadcastChannel valida versão, UUIDs, geração e payload. Access trafega apenas
  de modo efêmero same-origin; geração antiga é rejeitada.
- Sem Web Locks, nenhum refresh automático ocorre, preservando reuse detection.

## Tenant e navegação

- Bootstrap autenticado é a fonte única de user, Organizations, membership e
  role; nenhum desses dados é derivado do JWT.
- Somente `genesis.activeOrganizationId.v1`, contendo UUID, pode ser persistido.
- A preferência nunca concede autorização e sempre é confrontada com bootstrap.
- Cache autenticado é segmentado e removido em troca, logout ou expiração.
- `returnTo` aceita somente `/app` e `/app/**`, sem URL absoluta, esquema,
  host, barra invertida ou controle.
- Shell e not found administrativo permanecem protegidos sem flash.

## HTTP e dados

- Browser chama apenas paths relativos canonicalizados dentro de `/api/v1` com
  credentials; segmentos que escapariam do namespace são rejeitados.
- Resposta HTML ou content type inesperado em API é erro de protocolo.
- Bodies de resposta possuem limite defensivo e `429` impõe cooldown local sem
  presumir `Retry-After`.
- Nenhum componente/página executa fetch diretamente.
- Nenhum token, senha, cookie, bootstrap completo ou PII é registrado.
- ETag permanece opaco; If-Match e Idempotency-Key são enviados somente quando
  solicitados pela feature.
- Comandos de Lead que combinam concorrência e idempotência exigem ambos os
  headers e nunca aceitam `If-Match: *`. A mesma chave é reutilizada somente
  para uma nova tentativa manual do mesmo payload após resultado remoto incerto,
  inclusive quando houve um replay de refresh; alterar ou abandonar o intento
  descarta essa chave.

## Dados de Leads

- PII de Lead, busca, diretório de responsáveis e rascunhos permanecem somente
  em memória; não entram em storage, logs, telemetria, URL do navegador ou
  BroadcastChannel.
- Query Cache é segmentado por Organization e removido em troca, logout e
  expiração. A busca pode existir na chave em memória, sem persistência.
- Somente owner/admin consulta memberships ativas. Member não recebe diretório
  nem controle de atribuição; nomes indisponíveis usam rótulos mínimos.
- ETags são vinculados ao id e à revisão do snapshot sem parsing ou reconstrução.
  Conflitos preservam o rascunho, relêem a fonte e não reenviam mutações.
- Cards do Pipeline não renderizam telefone, e-mail, UUID, cidade, Instagram ou
  descrição livre. A resposta completa permanece apenas no Query Cache em
  memória.
- Cursores do Kanban são opacos, restritos à coluna, Organization e filtros da
  query; não são decodificados, fabricados, registrados ou persistidos.
- O move usa somente ETag opaco do detalhe compatível. A chave idempotente não
  contém PII e muda com Organization, Lead, revisão de origem ou destino; um
  resultado remoto incerto exige retry ou abandono explícito.
- Fixtures usam exclusivamente identidades e domínios `.test`.
- Filas de Follow-up convertem a resposta recebida em modelos sem telefone ou
  e-mail antes do Query Cache especializado. Nenhuma PII ou UUID é renderizada
  como conteúdo operacional; dados completos exigem abertura do detalhe.
- Tabs administrativas e diretório não são montados para member. Capabilities
  são apenas UX e o backend revalida papel, assignment, estado e tenant.
- Ações rápidas usam ETag apenas de detalhe compatível ou novo GET. Complete,
  reschedule, cancel e dismiss vinculam a chave a Organization, ator, Lead,
  revisões, recurso e payload; nenhuma chave contém PII.
- Resultado incerto preserva intenção exata para retry, verificação ou abandono.
  Assignment não possui chave e só permite verificar o estado, nunca replay
  cego. `409/412` descartam a intenção antiga.
- Filtros, cursores, contexto de retorno e rascunhos dos diálogos permanecem em
  memória. Não entram em URL, storage, logs ou BroadcastChannel.
- Métricas agregadas continuam sendo dados comerciais sensíveis. Somente
  owner/admin veem a navegação e montam a query; member e perda de papel
  cancelam/removem a sub-raiz `leads/metrics`, sem renderizar dados anteriores.
- Keys de Metrics incluem Organization e período canônico. Cache permanece em
  memória e é removido também na troca de Organization, logout e expiração;
  respostas tardias do tenant anterior não atravessam os providers.
- Somente datas civis não sensíveis entram na query string. Payload, contagens,
  sources e timezone não entram em storage, logs, BroadcastChannel ou
  telemetria. Fixtures e screenshots usam dados sintéticos.
- O draft de criação e sua intenção idempotente ficam somente em memória, fora
  de Query Cache, Mutation Cache encerrado, URL, storage, logs, telemetria e
  BroadcastChannel. A chave vincula Organization, ator e payload exato sem
  conter PII; retry incerto reutiliza essa chave e não é automático.
- Troca confirmada de Organization desmonta formulário e intenção antes do novo
  tenant. Logout faz o mesmo sem confirmação. Resposta tardia da instância
  desmontada não navega, não invalida cache e não atualiza feedback.
- Member não consulta diretório, não envia responsável e trata `204` de modo
  opaco. Owner/admin só navegam com ID validado do body; ETag e `Location` são
  aceitos do backend e nunca construídos pelo frontend.

## Ambientes

`GENESIS_API_PROXY_TARGET` é server-only no Vite e rejeita credenciais, paths,
queries, fragmentos e protocolos diferentes de HTTP(S). Variáveis `VITE_*` são
públicas e não podem conter segredos. Previews permanecem sem acesso à API e
nunca apontam para produção. Proxy Vercel, domínio e deploy não estão
configurados.

## Fronteira de autorização

O backend NestJS continua validando sessão, Organization, membership e papel em
cada request. Guards e menus frontend são apenas experiência de navegação e não
substituem autorização.
