import { Outlet } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  CircleUserRound,
  HelpCircle,
  LogOut,
  Menu,
} from "lucide-react";
import { useState } from "react";

import { AdminNavigation } from "@/features/admin/AdminNavigation";
import { Brand } from "@/shared/components/Brand";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/Sheet";

function OrganizationMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Selecionar empresa"
        >
          <Building2
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="hidden max-w-36 truncate sm:inline">Empresa</span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Contexto atual</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <Building2 className="size-4" />
          Integração pendente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="grid size-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CircleUserRound className="size-5" aria-hidden="true" />
          <span className="sr-only">Abrir menu do usuário</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sessão não conectada</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <HelpCircle className="size-4" />
          Central de ajuda
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-[var(--layer-navigation)] hidden w-[var(--sidebar-width)] border-r border-border bg-surface p-5 lg:block">
        <Brand />
        <div className="mt-8">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Operação
          </p>
          <AdminNavigation />
        </div>
        <div className="absolute inset-x-5 bottom-5 rounded-lg border border-border bg-muted/50 p-3">
          <Badge variant="warning">Bootstrap</Badge>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Dados e sessão serão conectados em tarefas futuras.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-[var(--layer-header)] flex h-[var(--header-height)] items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="size-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="sr-only">Menu principal</SheetTitle>
                <SheetDescription className="sr-only">
                  Navegação da área administrativa.
                </SheetDescription>
                <Brand />
                <div className="mt-8">
                  <AdminNavigation
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Brand />
          </div>

          <div className="hidden lg:block">
            <p className="text-sm font-medium text-foreground">
              Área administrativa
            </p>
            <p className="text-xs text-muted-foreground">
              Fundação operacional
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OrganizationMenu />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
