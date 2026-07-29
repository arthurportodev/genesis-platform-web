import type {
  LeadNextActionState,
  LeadStage,
  LeadStatus,
  Member,
} from "@/features/leads/api/lead-contracts";

export const statusLabels: Record<LeadStatus, string> = {
  active: "Ativo",
  won: "Ganho",
  lost: "Perdido",
  archived: "Arquivado",
};

export const stageLabels: Record<LeadStage, string> = {
  new: "Novo",
  qualification: "Qualificação",
  diagnosis: "Diagnóstico",
  proposal: "Proposta",
  negotiation: "Negociação",
};

export const temporalLabels: Record<LeadNextActionState, string> = {
  none: "Sem próxima ação",
  overdue: "Atrasada",
  today: "Hoje",
  future: "Futura",
};

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function responsibleLabel(
  membershipId: string | null,
  currentMembershipId: string,
  members: readonly Member[],
): string {
  if (!membershipId) return "Sem responsável";
  if (membershipId === currentMembershipId) return "Você";
  return (
    members.find(({ id }) => id === membershipId)?.name ??
    "Responsável atribuído"
  );
}

export function timelineEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "lead.created": "Lead criado",
    "lead.entry.received": "Nova entrada recebida",
    "lead.basic_data.updated": "Dados atualizados",
    "lead.assignment.changed": "Responsável alterado",
    "lead.assignment.cleared": "Responsável removido",
    "lead.stage.changed": "Etapa alterada",
    "lead.won": "Lead ganho",
    "lead.lost": "Lead perdido",
    "lead.archived": "Lead arquivado",
    "lead.reactivated": "Lead reativado",
    "lead.return.received": "Retorno recebido",
    "lead.return.dismissed": "Revisão de retorno dispensada",
    "lead.activity.created": "Atividade registrada",
    "lead.note.created": "Nota adicionada",
    "lead.next_action.created": "Próxima ação criada",
    "lead.next_action.rescheduled": "Próxima ação reagendada",
    "lead.next_action.completed": "Próxima ação concluída",
    "lead.next_action.canceled": "Próxima ação cancelada",
  };
  return labels[eventType] ?? "Atualização do Lead";
}
