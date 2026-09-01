# Direção de experiência frontend

Este documento traduz a direção de produto da Genesis em princípios duráveis
de experiência frontend. Ele orienta decisões de interface sem registrar estado
temporal, roadmap, tarefa ou implementação específica.

## Princípios

- **Simplicidade:** cada superfície deve tornar a intenção principal evidente.
- **Velocidade operacional:** fluxos frequentes favorecem resposta rápida,
  poucos cliques e continuidade de contexto.
- **Baixa densidade visual:** informação e controles competem por atenção
  somente quando ajudam a tarefa corrente.
- **Hierarquia clara:** informação comercial vem antes de informação técnica;
  tipografia, espaçamento e composição comunicam prioridade.
- **Cor com função:** cor indica significado, estado ou ação; não compensa falta
  de hierarquia.
- **Feedback rápido e honesto:** loading, sucesso, falha, conflito e resultado
  incerto aparecem cedo, com peso proporcional e sem antecipar confirmação do
  backend.
- **Acessibilidade:** teclado, foco, nomes acessíveis, contraste, movimento e
  alternativas de interação fazem parte da experiência principal.
- **Responsividade:** cada fluxo preserva compreensão e ação nos tamanhos de tela
  suportados, sem transportar densidade desktop para telas menores.
- **Consistência:** padrões existentes são reutilizados antes de criar novas
  abstrações ou comportamentos.

> Tudo que não ajuda o usuário a entender, decidir ou agir deve perder peso
> visual.

## Referência funcional

Bitrix24 é referência funcional principalmente para fluidez, rapidez, facilidade
operacional, manipulação de negociações e baixo atrito. Não é referência para
copiar densidade, excesso de funcionalidades, excesso de cores ou identidade
visual.

## Fronteiras

A arquitetura permanece `app → features/shared`, conforme
[ARCHITECTURE.md](ARCHITECTURE.md). O frontend consome regras autoritativas do
backend para domínio, tenant, autorização, concorrência e dados. UX não é local
para reinventar essas regras ou apresentar estado derivado como confirmado.

A Product Direction canônica no repositório API decide direção e escopo de
produto; ADRs preservam decisões técnicas; iniciativas delimitam estados-alvo;
Task Packets autorizam deltas executáveis. A Skill de frontend é somente uma
lente especializada do Builder sobre essas autoridades.

## Não objetivos

Este documento não mantém estado atual, roadmap, SHAs, tarefa corrente,
especificação temporal, detalhes de implementação do Pipeline ou cópia de ADRs.
