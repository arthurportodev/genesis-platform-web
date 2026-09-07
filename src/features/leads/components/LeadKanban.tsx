import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/react";

import type {
  LeadListItem,
  Member,
  PipelineStage,
} from "@/features/leads/api/lead-contracts";
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
}

function isInteractiveCardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-no-drag]") !== null;
}

const pipelineSensors = [
  PointerSensor.configure({
    preventActivation: (event) =>
      event.pointerType === "touch" || isInteractiveCardTarget(event.target),
  }),
  KeyboardSensor.configure({
    offset: { x: 320, y: 80 },
    preventActivation: (event) => isInteractiveCardTarget(event.target),
  }),
];

export function LeadKanban({
  pipelineId,
  stages,
  columns,
  members,
  organization,
  busyLeadId,
  movesDisabled,
  mobileStage,
  onMobileStageChange,
  onMove,
}: {
  pipelineId: string;
  stages: readonly Pick<PipelineStage, "id" | "name" | "position">[];
  columns: readonly ColumnState[];
  members: readonly Member[];
  organization: ActiveOrganization;
  busyLeadId: string | null;
  movesDisabled: boolean;
  mobileStage: string | null;
  onMobileStageChange: (stageId: string) => void;
  onMove: (
    lead: LeadListItem,
    targetStageId: string,
    targetStageName: string,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
}) {
  const currentMobileStage =
    stages.find((stage) => stage.id === mobileStage) ?? stages[0];
  const currentMobileColumn = columns.find(
    ({ column }) => column.stage.id === currentMobileStage?.id,
  );
  const columnProps = (state: ColumnState, instance: "mobile" | "desktop") => ({
    ...state,
    pipelineId,
    stages,
    instance,
    members,
    organization,
    busyLeadId,
    movesDisabled,
    onLoadMore: () => void state.fetchMore(),
    onRetry: () => void state.fetchMore(),
    onMove,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { operation } = event;
    const sourceData = operation.source?.data as
      { kind?: string; lead?: LeadListItem; canMove?: boolean } | undefined;
    const targetData = operation.target?.data as
      { kind?: string; pipelineId?: string; stage?: PipelineStage } | undefined;
    if (
      event.canceled ||
      movesDisabled ||
      busyLeadId !== null ||
      sourceData?.kind !== "pipeline-lead" ||
      !sourceData.lead ||
      !sourceData.canMove ||
      targetData?.kind !== "pipeline-stage" ||
      !targetData.stage ||
      targetData.pipelineId !== pipelineId ||
      sourceData.lead.pipelineId !== pipelineId ||
      sourceData.lead.pipelineStageId === targetData.stage.id
    )
      return;
    const focusTarget =
      operation.source?.element instanceof HTMLElement
        ? operation.source.element
        : null;
    void onMove(
      sourceData.lead,
      targetData.stage.id,
      targetData.stage.name,
      focusTarget,
    );
  };

  if (!currentMobileStage || !currentMobileColumn) return null;
  return (
    <DragDropProvider sensors={pipelineSensors} onDragEnd={handleDragEnd}>
      <section aria-label="Pipeline de Leads" className="space-y-4">
        <div className="md:hidden">
          <Label htmlFor="pipeline-mobile-stage">Etapa exibida</Label>
          <Select
            id="pipeline-mobile-stage"
            className="mt-1.5 min-h-11"
            value={currentMobileStage.id}
            onChange={(event) => onMobileStageChange(event.target.value)}
          >
            {columns.map(({ column }) => (
              <option key={column.stage.id} value={column.stage.id}>
                {column.stage.name} · {column.total}
              </option>
            ))}
          </Select>
          <div className="mt-4">
            <LeadKanbanColumn {...columnProps(currentMobileColumn, "mobile")} />
          </div>
        </div>
        <div
          className="hidden gap-4 overflow-x-auto pb-3 md:flex"
          data-testid="pipeline-desktop-board"
        >
          {columns.map((column) => (
            <LeadKanbanColumn
              key={column.column.stage.id}
              {...columnProps(column, "desktop")}
            />
          ))}
        </div>
      </section>
    </DragDropProvider>
  );
}
