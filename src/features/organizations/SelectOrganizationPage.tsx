import { Building2 } from "lucide-react";

import { Brand } from "@/shared/components/Brand";
import { OperationalState } from "@/shared/components/OperationalState";

export function SelectOrganizationPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Brand />
        <div className="mt-16 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Selecione uma organização
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            O contexto organizacional será carregado a partir da sessão quando a
            integração estiver disponível.
          </p>
        </div>
        <div className="mt-8">
          <OperationalState
            kind="unavailable"
            title="Organizações ainda não disponíveis"
            description="Nenhuma organização é simulada nesta fundação. A seleção será habilitada junto ao contrato real de sessão."
            action={{ label: "Voltar ao login", href: "/login" }}
          />
        </div>
      </div>
    </main>
  );
}
