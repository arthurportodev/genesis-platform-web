import type {
  LeadListItem,
  LeadStage,
  Member,
} from "@/features/leads/api/lead-contracts";
import { leadStages } from "@/features/leads/api/lead-contracts";
import { stageLabels } from "@/features/leads/api/lead-labels";
import { LeadKanbanColumn } from "@/features/leads/components/LeadKanbanColumn";
import type { LeadKanbanViewColumn } from "@/features/leads/model/lead-kanban";
import type { ActiveOrganization } from "@/shared/organization/active-organization";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

interface ColumnState {
  column: LeadKanbanViewColumn;
  isFetchingMore: boolean;
  continuationError: Error | null;
  fetchMore: () => Promise<void>;
  retry: () => Promise<void>;
}

export function LeadKanban({
  columns,
  members,
  organization,
  busyLeadId,
  movesDisabled,
  mobileStage,
  onMobileStageChange,
  onMove,
}: {
  columns: Record<LeadStage, ColumnState>;
  members: readonly Member[];
  organization: ActiveOrganization;
  busyLeadId: string | null;
  movesDisabled: boolean;
  mobileStage: LeadStage;
  onMobileStageChange: (stage: LeadStage) => void;
  onMove: (
    lead: LeadListItem,
    targetStage: LeadStage,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
}) {
  const columnProps = (stage: LeadStage, instance: "mobile" | "desktop") => {
    const state = columns[stage];
    return {
      column: state.column,
      instance,
      members,
      organization,
      busyLeadId,
      movesDisabled,
      isFetchingMore: state.isFetchingMore,
      continuationError: state.continuationError,
      onLoadMore: () => void state.fetchMore(),
      onRetry: () => void state.retry(),
      onMove,
    };
  };
  return (
    <section aria-label="Pipeline de Leads" className="space-y-4">
      <div className="md:hidden">
        <Label htmlFor="pipeline-mobile-stage">Etapa exibida</Label>
        <Select
          id="pipeline-mobile-stage"
          className="mt-1.5 min-h-11"
          value={mobileStage}
          onChange={(event) =>
            onMobileStageChange(event.target.value as LeadStage)
          }
        >
          {leadStages.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabels[stage]} · {columns[stage].column.total}
            </option>
          ))}
        </Select>
        <div className="mt-4">
          <LeadKanbanColumn {...columnProps(mobileStage, "mobile")} />
        </div>
      </div>
      <div
        className="hidden gap-4 overflow-x-auto pb-3 md:flex"
        data-testid="pipeline-desktop-board"
      >
        {leadStages.map((stage) => (
          <LeadKanbanColumn key={stage} {...columnProps(stage, "desktop")} />
        ))}
      </div>
    </section>
  );
}
