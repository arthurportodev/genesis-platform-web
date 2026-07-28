import { Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";

import { Brand } from "@/shared/components/Brand";
import { buttonVariants } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

export function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <Brand className="mb-12 justify-center" />
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-destructive">
          Acesso negado
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Você não pode acessar esta área
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Confirme a organização e as permissões associadas à sua sessão antes
          de tentar novamente.
        </p>
        <Link
          to="/login"
          search={{ returnTo: undefined }}
          className={cn(buttonVariants({ variant: "secondary" }), "mt-7")}
        >
          Voltar ao login
        </Link>
      </div>
    </main>
  );
}
