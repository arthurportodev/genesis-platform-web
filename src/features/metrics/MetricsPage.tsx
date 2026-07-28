import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";

export function MetricsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Análise"
        title="Métricas"
        description="Acompanhe indicadores confiáveis a partir dos dados oficiais da operação."
      />
      <OperationalState
        kind="empty"
        title="Sem métricas calculadas"
        description="Nenhum indicador é inventado neste bootstrap. Os cálculos dependerão da fonte de dados oficial."
      />
    </div>
  );
}
