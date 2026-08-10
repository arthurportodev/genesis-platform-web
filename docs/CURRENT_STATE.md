<!-- genesis-memory-bridge:v1 -->

# Ponte para o estado canônico

Este repositório não mantém uma projeção nem uma cópia manual da memória
temporal da Genesis Platform. A autoridade única do Genesis Harness v0.1 fica
no repositório `arthurportodev/genesis-platform-api`, no caminho
`docs/memory/project-state.v1.json` da branch `main`.

Resolva primeiro
[`memory/project-state.pointer.v1.json`](memory/project-state.pointer.v1.json)
e siga, nesta ordem:

1. checkout explícito fornecido pelo operador;
2. checkout irmão da API;
3. origem remota pública em modo read-only.

Valide identidade, major de schema, receipt e `memoryRevision` antes de usar os
fatos retornados. O pointer é somente localização, compatibilidade e
proveniência; ele não contém fase, trabalho, fatos operacionais, blockers nem
decisões humanas.

Se a autoridade não puder ser lida, reporte `AUTHORITY_UNAVAILABLE` e mantenha
os fatos como desconhecidos. Durante a janela Web-first/API-last, reporte também
`MEMORY_TRANSITION_PENDING` quando o receipt ainda não tiver sido ativado pela
autoridade. Esses estados podem coexistir. Nunca use uma versão anterior deste
arquivo, o roadmap, um ADR ou outro documento Web como fallback temporal.
