import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";

export function PipelinePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Vendas"
        title="Pipeline"
        description="Visualize etapas e movimentações comerciais com rastreabilidade."
      />
      <OperationalState
        kind="empty"
        title="Pipeline sem dados"
        description="As etapas e oportunidades serão carregadas somente por uma integração real."
      />
    </div>
  );
}
