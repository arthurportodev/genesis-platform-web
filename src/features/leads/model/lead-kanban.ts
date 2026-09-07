import type {
  DynamicKanbanResponse,
  LeadListItem,
  PipelineStage,
} from "@/features/leads/api/lead-contracts";

export interface LeadKanbanViewColumn {
  stage: Pick<PipelineStage, "id" | "name" | "position">;
  total: number;
  expectedValueTotalMinor: string;
  withoutExpectedValue: number;
  items: LeadListItem[];
  nextCursor: string | null;
  limit: number;
}

export interface LeadKanbanSummary {
  opportunityCount: number;
  expectedValueTotalMinor: string;
  withoutExpectedValue: number;
  currency: "BRL";
}

export function composeDynamicKanbanColumn(
  stage: Pick<PipelineStage, "id" | "name" | "position">,
  pages: readonly DynamicKanbanResponse[],
): LeadKanbanViewColumn {
  const items = new Map<string, LeadListItem>();
  for (const page of pages) {
    const column = page.columns.find((item) => item.stage.id === stage.id);
    for (const item of column?.items ?? []) {
      const current = items.get(item.id);
      if (!current || BigInt(item.revision) > BigInt(current.revision))
        items.set(item.id, item);
    }
  }
  const first = pages[0]?.columns.find((item) => item.stage.id === stage.id);
  const last = pages.at(-1)?.columns.find((item) => item.stage.id === stage.id);
  return {
    stage,
    total: first?.total ?? 0,
    expectedValueTotalMinor: first?.expectedValueTotalMinor ?? "0",
    withoutExpectedValue: first?.withoutExpectedValue ?? 0,
    items: [...items.values()].filter(
      (item) => item.pipelineStageId === stage.id,
    ),
    nextCursor: last?.page.nextCursor ?? null,
    limit: last?.page.limit ?? 20,
  };
}

export function composeLeadKanbanSummary(
  response: DynamicKanbanResponse,
): LeadKanbanSummary {
  return {
    opportunityCount: response.columns.reduce(
      (total, column) => total + column.total,
      0,
    ),
    expectedValueTotalMinor: response.expectedValueTotalMinor,
    withoutExpectedValue: response.withoutExpectedValue,
    currency: response.currency,
  };
}

export function activePipelineStages(
  stages: readonly PipelineStage[],
): PipelineStage[] {
  return [...stages]
    .filter((stage) => stage.archivedAt === null)
    .sort((left, right) => left.position - right.position);
}

export function leadMoveDestinations(
  stages: readonly Pick<PipelineStage, "id" | "name" | "position">[],
  currentStageId: string | null,
) {
  return stages.filter((stage) => stage.id !== currentStageId);
}
