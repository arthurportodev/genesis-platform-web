# ADR-013 — Arquitetura de experiência do Pipeline V2

- Estado: Proposed — candidato para Gate 1
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

O Pipeline terá `+ Nova oportunidade` em sheet lateral; mobile pode usar o mesmo
sheet em tela cheia. Formulário, validação, hook, idempotência, tratamento de
resultado incerto, autorização e invalidations do fluxo manual existente serão
reutilizados, não copiados.

O backend continua escolhendo o estágio inicial. Quando o contrato financeiro
estiver disponível, o quick create permitirá informar valor esperado. A UI não
pode prometer sempre um card novo ou visível: a operação pode criar Lead,
adicionar Entry a Lead existente, devolver resultado opaco para member ou criar
um item ocultado pelos filtros atuais. Dirty state e intenção incerta bloqueiam
fechamento/navegação nas mesmas condições do fluxo atual.

Esta decisão revisa somente a limitação de entrada da criação à Inbox registrada
no ADR-007. Todas as suas semânticas de privacidade, resposta por papel,
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

### Fronteira de estágios

Os cinco estágios canônicos e seus valores de contrato permanecem no primeiro
release. Este ADR não cria `PipelineStage`, não substitui enums e não altera o
banco ou a API de movimento.

Novos componentes de apresentação não devem incorporar novas enumerações dos
cinco estágios. Uma fronteira de catálogo/descriptor ordenado, derivada do
contrato canônico atual, fornece identidade, label e posição para o board. O
board e suas colunas recebem uma coleção ordenada em vez de assumir quantidade
fixa na composição visual. Queries e contratos só deixam de ser estáticos
quando existir API dinâmica aprovada.

Estágios configuráveis por Organization pertencem oficialmente ao roadmap do
Pipeline V2, mas formam programa Critical posterior. Esse programa exigirá ADR
próprio, entidade tenant-scoped, IDs estáveis, posição, ativo/inativo, estágio
inicial e alvo de reativação, snapshot do nome histórico e migration estrutural.
Uma etapa com oportunidades ativas não poderá ser removida; a primeira versão
permitirá desativação somente quando vazia, salvo operação atômica explícita de
migração aprovada depois.

### Estado, ordenação e limites

Busca, filtros, estágio mobile e cache tenant-scoped continuam com o modelo em
memória atual. Nenhum novo uso de localStorage/sessionStorage é autorizado.
Painel lateral preserva o board montado; se navegação completa continuar, a
preservação de scroll interno poderá ser adicionada em memória.

O sorting atual por criação permanece inalterado no primeiro release. Uma
ordenação operacional por próxima ação depende de validação de uso real e de
uma iniciativa posterior de contrato/cursor. Reorder manual e ordenação por
valor também ficam fora do escopo.

Este ADR não autoriza valor/backend, migration, DnD dependency, redesign de
produto, quick create, painel, estágio dinâmico, sorting, sidebar, deploy ou
operação remota. Cada capacidade exige tarefa e gate próprios.

## Alternativas consideradas

- **DnD com mutation ou cache próprios:** rejeitado por duplicar concorrência,
  idempotência, conflito e resultado incerto.
- **Optimistic update inicial:** rejeitado porque o fluxo existente prioriza
  autoridade do servidor e não há evidência que justifique relaxá-lo.
- **Remover o fallback de movimento:** rejeitado por acessibilidade, mobile e
  resiliência operacional.
- **HTML Drag and Drop nativo:** não recomendado para a primeira escolha por
  custo próprio de teclado, touch, acessibilidade e scroll aninhado.
- **Quick create modal ou inline:** rejeitados como direção principal por menor
  preservação de contexto ou duplicação de formulário/layout.
- **Detalhe somente em estado local:** rejeitado por quebrar Back e deep link.
- **Estágios dinâmicos no primeiro release:** rejeitados por misturar evolução
  de experiência com migration estrutural e histórico.
- **Alterar o shell global pelo Pipeline:** rejeitado por ampliar regressão e
  ownership além da feature.

## Consequências

- A segurança do movimento atual permanece a única autoridade de escrita.
- DnD adiciona custo de dependência e acessibilidade somente após spike
  aprovado; o fallback reduz risco de exclusão de usuários.
- A UI passa a depender de agregados financeiros backend corretos antes de
  exibir totals.
- Quick create e detalhe lateral exigem extração/composição de componentes, não
  duplicação de regras.
- A fronteira de catálogo reduz novos acoplamentos, mas não finge que estágios
  já são dinâmicos.
- Sidebar, sorting e programa de estágios continuam iniciativas separadas.
- Este ADR produz arquitetura implementável para Gate 1, sem declarar nenhuma
  capacidade nova como entregue.

## Relações

- **ADR-004:** permanecem válidos os cinco estágios do primeiro release, carga
  agregada, queries híbridas, paginação, deduplicação, totals backend,
  server-confirmation, ausência de optimistic update, snapshot compatível,
  idempotência, conflito, resultado incerto, invalidação e autoridade backend.
  Deixam de ser decisões duráveis a substituição permanente de DnD pelo controle
  e a composição fixa do conteúdo dos cards. “Nenhuma dependência” continua
  fato histórico do ADR-004, não restrição ao spike futuro.
- **ADR-007:** preservado, exceto pela futura disponibilidade da mesma criação
  reutilizada dentro do Pipeline.
- **ADR-011:** preserva a prova restrita strong/weak do snapshot; este ADR não
  reconstrói ETag a partir do Kanban.
- **ADR-012:** preserva o shim browser-facing e o `If-Match` no hop upstream;
  DnD usa o mesmo cliente/mutation e não contorna esse transporte.
- O ADR API de valor esperado no ciclo comercial é pré-condição para valor em
  cards, totals e quick create.
- Um ADR específico de estágios configuráveis só será criado quando o programa
  correspondente for autorizado.

## Implementação

Não implementado. Este documento é candidato de arquitetura para Gate 1. As
capacidades descritas serão entregues em tarefas pequenas após aprovação humana
e seus gates específicos.
