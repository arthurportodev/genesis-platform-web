import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";

export function FollowUpPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Relacionamento"
        title="Follow-up"
        description="Organize os próximos contatos e preserve o histórico de cada oportunidade."
      />
      <OperationalState
        kind="unavailable"
        title="Follow-ups indisponíveis"
        description="A agenda será habilitada depois que os serviços de domínio forem conectados."
      />
    </div>
  );
}
