import { Plus } from "lucide-react";

import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/ui/Button";

export function LeadsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Relacionamento"
        title="Leads"
        description="Consulte, filtre e organize oportunidades assim que a fonte oficial de dados estiver disponível."
        action={
          <Button disabled>
            <Plus className="size-4" aria-hidden="true" />
            Novo lead
          </Button>
        }
      />
      <OperationalState
        kind="empty"
        title="Nenhum lead para exibir"
        description="A listagem permanece vazia de forma intencional: este bootstrap não cria dados fictícios nem consulta a API."
      />
    </div>
  );
}
