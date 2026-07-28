# Visão do projeto

A Genesis Platform Web é a interface administrativa da operação comercial. A
fundação oferece navegação, composição visual, formulários, estados operacionais
e infraestrutura de qualidade para evoluções posteriores.

## Stack oficial

- React 19, Vite 8 e TypeScript estrito.
- TanStack Router e TanStack Query.
- Tailwind CSS e componentes locais no padrão shadcn/ui.
- React Hook Form e Zod.
- Vitest, Testing Library, MSW e Playwright.

## Escopo implementado

- Login real e restauração de sessão pelo contrato cookie-only de refresh.
- Access token somente em memória, CSRF e coordenação segura entre abas.
- Bootstrap e seleção de Organization ativa validada.
- Cliente HTTP, guards, isolamento de cache tenant e infraestrutura de
  ETag/idempotência.
- Shell administrativo responsivo e rotas canônicas.
- Estados vazios, indisponíveis, de carregamento e de erro reutilizáveis.
- Pipeline de validação local e CI.

## Fora do escopo

Autorização real continua no backend. Telemetria, dados e mutações de CRM,
persistência de Query Cache e deploy remoto permanecem fora do escopo.

## Destinos planejados

O domínio planejado é `app.agenciagenesis.com.br` e o destino de deploy é a
Vercel. O único backend oficial é `arthurportodev/genesis-platform-api`. A
integração do navegador usa path relativo `/api/v1` e proxy Vite local. O proxy
externo da Vercel, domínio, DNS e deploy continuam não configurados; previews
permanecem fail-closed e não acessam produção.
