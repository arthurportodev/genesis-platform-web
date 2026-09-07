# ADR-013 — Arquitetura de experiência do Pipeline V2

- Estado: Accepted — atualizado para Pipelines dinâmicos na PIPE-V2-06
- Data: 2026-08-25
- Revisa parcialmente: ADR-004
- Complementa: ADR-007, ADR-011 e ADR-012

## Contexto

O Pipeline deve se tornar o principal ambiente de trabalho comercial da
Genesis, sem transformar o produto em um CRM generalista de alta densidade. A
experiência precisa destacar oportunidade, valor esperado e próxima ação,
reduzir interrupções de fluxo e preservar as garantias já implementadas para
tenant, autorização, concorrência e resultado remoto incerto.

O Pipeline atual usa cinco estágios canônicos, carga inicial agregada,
continuação independente por coluna, deduplicação por revisão e movimento
server-confirmed por um controle acessível. A criação manual existe em página
própria e o detalhe usa rota completa. Não há DnD, valor financeiro, criação no
Pipeline, painel lateral ou estágios configuráveis.

O Pipeline V2 introduzirá essas capacidades em fases. O primeiro release não
migra estágios nem altera sorting, shell global ou autoridade backend.

## Decisão

### Princípios de experiência

O Pipeline é orientado a entender, decidir e agir. Sua composição prioriza:

- simplicidade, poucos cliques e baixa densidade;
- informação comercial acima de metadados técnicos;
- cards como principal unidade visual sobre workspace claro e sutil;
- pouca cor, bordas suaves, sombra mínima e hierarquia tipográfica forte;
- valor esperado e próxima ação como informações primárias;
- estados de loading, falha, conflito, resultado incerto e paginação explícitos,
  porém visualmente proporcionais.

A implementação deve preferir composição e componentes específicos do
Pipeline. Não alterará indiscriminadamente primitives compartilhadas. A sidebar
escura pertence a iniciativa global posterior do shell; este ADR não autoriza
mudança em `AdminShell` ou tokens globais de navegação.

### Informações e agregados

Cada card apresentará como hierarquia principal nome, valor esperado e próxima
ação. Empresa e origem/canal são secundários; responsável, atualização e
outros metadados recebem peso menor. Ações secundárias podem usar menu, desde
que reutilizem capacidades reais e não inventem domínio.

Cada estágio apresentará nome, quantidade total e valor esperado total. O
Pipeline poderá apresentar quantidade e valor total gerais. Contagens e valores
vêm exclusivamente do agregado completo do backend, com os mesmos filtros e
visibilidade; páginas carregadas nunca são somadas como se fossem o total.

`X de Y carregados` deixa de ser destaque de cabeçalho. Quando toda a coluna
estiver carregada, pode desaparecer. Quando houver continuação, o controle
permanece compreensível e acessível, com linguagem operacional discreta.

### Movimento e drag-and-drop

No desktop, DnD será a interação principal de movimento. Ele é somente um novo
input para o fluxo existente:

```text
dragEnd válido → mesma intenção confirmMove → mesmo snapshot/revisão →
mesma idempotência → mesmo endpoint → mesma confirmação/refetch
```

Não haverá mutation, endpoint, política de autorização ou escrita de cache
específica para DnD. O movimento permanece server-confirmed e o card permanece
na origem até a releitura autoritativa. Não haverá optimistic update no primeiro
release.

O board registra colunas como destinos; não implementa reorder manual dentro da
coluna. Drop no mesmo estágio, fora de destino ou cancelado não produz comando.
Card sem capacidade não é draggable. Enquanto uma intenção estiver em
preflight, movimento, refresh ou estado remoto incerto, novos movimentos são
desabilitados segundo o controlador existente. Conflito de revisão, falha de
rede, retry e abandono continuam seguindo o mesmo fluxo atual.

Um drag overlay oferece feedback sem remover o card autoritativo da origem. O
destino é comunicado por mais de um sinal visual. Scroll horizontal do board e
vertical das colunas deve ser verificado explicitamente antes de qualquer
customização de auto-scroll.

`LeadMoveControl`, ou controle funcionalmente equivalente, permanece disponível
como alternativa acessível. DnD deve oferecer handle rotulado, teclado,
cancelamento por Escape, live announcements, retorno de foco e reduced motion.
No mobile, a primeira versão mantém uma etapa por vez e o controle alternativo;
touch DnD fica fora do escopo.

A direção tecnológica é `@dnd-kit/react`, mas nenhuma dependência está aprovada
por este ADR isoladamente. Sua adoção exige spike Critical posterior que valide
React, TypeScript, Vite, pointer/keyboard/touch, acessibilidade, bundle, licença,
dependências transitivas, advisories e supply chain. Falha no spike reabre a
escolha tecnológica sem alterar a arquitetura de intenção única.

### Quick create

O Pipeline terá `Nova oportunidade` como segundo ponto de entrada para a página
completa existente `/app/leads/new?from=pipeline`. O search param validado
preserva o contexto em deep link e refresh sem transportar PII, draft, payload,
chave idempotente ou estado de negócio. Formulário, validação, hook,
idempotência, tratamento de resultado incerto, autorização e invalidations do
fluxo manual existente serão reutilizados, não copiados nem extraídos
prematuramente.

A mesma página usa o contexto visual de Vendas e retorna ao Pipeline em
resultados identificados. `201` anuncia uma oportunidade criada; `200` anuncia
uma nova entrada na oportunidade existente; replay anuncia somente resultado
confirmado. O `204` opaco continua retornando à Inbox sem inferir identidade ou
visibilidade. Voltar e cancelar retornam ao Pipeline, preservando os blockers do
fluxo existente.

O backend continua escolhendo o estágio inicial. A página reutilizada permite
informar o valor esperado pelo contrato financeiro existente. A UI não pode
prometer sempre um card novo ou visível: a operação pode criar Lead,
adicionar Entry a Lead existente, devolver resultado opaco para member ou criar
um item ocultado pelos filtros atuais. Dirty state e intenção incerta bloqueiam
fechamento/navegação nas mesmas condições do fluxo atual.

Esta decisão revisa somente a limitação de entrada manual exclusiva pela Inbox
registrada no ADR-007: a mesma criação agora pode começar pela Inbox ou pelo
Pipeline. Todas as demais semânticas de privacidade, resposta por papel,
idempotência em memória, ausência de optimistic update e invalidação continuam
válidas.

### Detalhe lateral

Uma fase posterior poderá abrir o detalhe em sheet lateral sem desmontar o
Kanban. A composição reutilizará a query/cache e os componentes de overview,
ações e timeline; não embutirá a página inteira dentro do sheet.

O painel será URL-backed: abrir faz push de estado navegável, Browser Back fecha
o painel e deep link é possível. A rota completa de detalhe permanece como
fallback e experiência mobile. Fechar restaura foco no card de origem. Busca,
filtros e PII do formulário não são persistidos em URL ou storage para produzir
essa navegação.

### Pipelines e estágios dinâmicos

O Pipeline selecionado é representado por
`/app/pipeline?pipelineId=<uuid>`. O URL é a autoridade da seleção; na ausência
de ID ou diante de um ID inválido para a Organization, a experiência usa o
Pipeline default. Não há persistência client-side adicional.

O board recebe da API as etapas ativas do Pipeline selecionado, ordenadas por
`position`. `pipelineStageId` é a identidade estrutural de colunas, destinos de
movimento e controles de configuração; o nome é apresentação. Um card só pode
pertencer ao Pipeline e à etapa declarados pelo agregado. Movimento entre
Pipelines não é uma operação de DnD.

Owner e admin podem criar e renomear Pipelines e criar, renomear, reordenar e
arquivar etapas pela superfície compacta do próprio Pipeline. A criação de um
Pipeline envia nome e ao menos uma etapa numa única intenção. Reordenação usa
controles explícitos de subir e descer; o DnD permanece reservado aos cards.
Members podem ler e alternar entre Pipelines conforme autorização da API.

Arquivar não remove histórico e não move oportunidades. A API bloqueia etapa
com ciclo aberto, último estágio ativo, revisão obsoleta ou escopo divergente.
Eventos históricos exibem os snapshots de nome retornados pela API, sem
reconstrução a partir do nome atual da etapa.

Um Lead ativo pode não possuir ciclo comercial ativo. Nesse estado, o detalhe
continua permitindo editar informações do Lead, apresenta `Sem Pipeline` e
oculta ações dependentes de ciclo. `Adicionar ao Pipeline` inicia explicitamente
um ciclo no primeiro estágio ativo por intenção condicional e idempotente.
Valor esperado permanece propriedade do ciclo e não é enviado na criação de
Lead sem Pipeline.

### Estado, ordenação e limites

Seleção de Pipeline, estágio mobile e cache tenant-scoped continuam com o modelo
em memória atual. Nenhum novo uso de localStorage/sessionStorage é autorizado.
Painel lateral preserva o board montado; se navegação completa continuar, a
preservação de scroll interno poderá ser adicionada em memória.

O sorting atual por criação permanece inalterado no primeiro release. Uma
ordenação operacional por próxima ação depende de validação de uso real e de
uma iniciativa posterior de contrato/cursor. Reorder manual e ordenação por
valor também ficam fora do escopo.

Este ADR não autoriza mudança de valor/backend, migration, redesign de produto,
painel, sorting, sidebar, deploy ou operação remota.

## Alternativas consideradas

- **DnD com mutation ou cache próprios:** rejeitado por duplicar concorrência,
  idempotência, conflito e resultado incerto.
- **Optimistic update inicial:** rejeitado porque o fluxo existente prioriza
  autoridade do servidor e não há evidência que justifique relaxá-lo.
- **Remover o fallback de movimento:** rejeitado por acessibilidade, mobile e
  resiliência operacional.
- **HTML Drag and Drop nativo:** não recomendado para a primeira escolha por
  custo próprio de teclado, touch, acessibilidade e scroll aninhado.
- **Quick create em sheet, modal ou inline:** rejeitado nesta entrega porque a
  página robusta existente preserva integralmente o formulário e suas garantias
  com menor delta e sem duplicação de layout ou lógica.
- **Detalhe somente em estado local:** rejeitado por quebrar Back e deep link.
- **Estado global ou storage para o Pipeline atual:** rejeitado porque o URL já
  fornece deep link, refresh e navegação previsíveis.
- **DnD para ordenar etapas:** rejeitado porque controles direcionais atendem ao
  escopo com menos interação e sem um segundo protocolo de drag.
- **Alterar o shell global pelo Pipeline:** rejeitado por ampliar regressão e
  ownership além da feature.

## Consequências

- A segurança do movimento atual permanece a única autoridade de escrita.
- DnD adiciona custo de dependência e acessibilidade somente após spike
  aprovado; o fallback reduz risco de exclusão de usuários.
- A UI passa a depender de agregados financeiros backend corretos antes de
  exibir totals.
- A nova entrada do Pipeline reutiliza a página completa de criação sem extração
  ou duplicação; o detalhe lateral permanece uma capacidade futura separada.
- IDs estáveis separam estrutura atual de nomes históricos apresentados na
  timeline.
- Leads sem ciclo deixam de ser representados artificialmente como oportunidade.
- Sidebar, sorting e outras ampliações continuam iniciativas separadas.

## Relações

- **ADR-004:** permanecem válidos carga agregada, paginação, deduplicação, totals
  backend, server-confirmation, ausência de optimistic update, snapshot
  compatível, idempotência, conflito, resultado incerto, invalidação e autoridade
  backend. Os cinco valores legados deixam de definir a estrutura visual do
  board, que passa a seguir os Pipelines e estágios retornados pela API.
- **ADR-007:** preservado, exceto pela disponibilidade da mesma criação manual
  reutilizada a partir do Pipeline além da Inbox.
- **ADR-011:** preserva a prova restrita strong/weak do snapshot; este ADR não
  reconstrói ETag a partir do Kanban.
- **ADR-012:** preserva o shim browser-facing e o `If-Match` no hop upstream;
  DnD usa o mesmo cliente/mutation e não contorna esse transporte.
- O ADR API de valor esperado no ciclo comercial permanece a autoridade para
  valor em cards, totals e criação manual.

## Implementação

A entrada de criação continua reutilizando a página completa. A PIPE-V2-06
substitui no board a autoridade do catálogo legado pela API de Pipelines,
mantendo o mesmo fluxo de movimento condicional, idempotente e confirmado pelo
servidor.
