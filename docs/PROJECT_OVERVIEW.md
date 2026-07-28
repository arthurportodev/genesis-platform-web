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

## Escopo desta fundação

- Login somente visual e com validação local.
- Seleção de organização explicitamente indisponível.
- Shell administrativo responsivo e rotas canônicas.
- Estados vazios, indisponíveis, de carregamento e de erro reutilizáveis.
- Pipeline de validação local e CI.

## Fora do escopo

Autenticação real, autorização, persistência de sessão, integração com API,
telemetria, dados de organizações, dados de leads e deploy remoto.

## Destinos planejados

O domínio planejado é `app.agenciagenesis.com.br` e o destino de deploy é a
Vercel. O único backend oficial é `arthurportodev/genesis-platform-api`. A
integração do navegador está planejada para a `0.7.1.2`, preferencialmente por
path same-origin/proxy da Vercel e sujeita ao Gate 1. Nada disso está configurado
ou publicado nesta fundação.
