import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";

import { Brand } from "@/shared/components/Brand";
import { cn } from "@/shared/lib/cn";
import { buttonVariants } from "@/shared/ui/Button";

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <Brand className="mb-12 justify-center" />
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          Erro 404
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          O endereço informado não corresponde a uma rota desta aplicação.
        </p>
        <Link
          to="/app"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-7")}
        >
          Ir para a visão geral
        </Link>
      </div>
    </main>
  );
}
