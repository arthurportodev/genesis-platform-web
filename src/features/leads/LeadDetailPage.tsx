import { useParams } from "@tanstack/react-router";

import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";

export function LeadDetailPage() {
  const { leadId } = useParams({ strict: false });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Leads"
        title="Detalhes do lead"
        description={
          leadId
            ? `Referência de rota: ${leadId}. Nenhum dado foi consultado.`
            : "Nenhuma referência de lead foi informada."
        }
      />
      <OperationalState
        kind="unavailable"
        title="Detalhes indisponíveis"
        description="A leitura do lead será implementada quando o contrato de API e a sessão estiverem integrados."
        action={{ label: "Voltar para leads", href: "/app/leads" }}
      />
    </div>
  );
}
