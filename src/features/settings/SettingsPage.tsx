import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Gerencie preferências e integrações dentro dos limites de acesso da organização."
      />
      <OperationalState
        kind="unavailable"
        title="Configurações ainda não habilitadas"
        description="Esta fundação não persiste preferências e não simula permissões de administrador."
      />
    </div>
  );
}
