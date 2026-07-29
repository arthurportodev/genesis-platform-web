import {
  leadStages,
  type LeadKanbanFilters,
  type LeadKanbanResponse,
  type LeadListItem,
  type LeadStage,
} from "@/features/leads/api/lead-contracts";

export interface LeadKanbanViewColumn {
  stage: LeadStage;
  total: number;
  items: LeadListItem[];
  nextCursor: string | null;
  limit: number;
}

interface Candidate {
  item: LeadListItem;
  asOf: string;
}

function newer(candidate: Candidate, current: Candidate): boolean {
  const candidateRevision = BigInt(candidate.item.revision);
  const currentRevision = BigInt(current.item.revision);
  if (candidateRevision !== currentRevision)
    return candidateRevision > currentRevision;
  return Date.parse(candidate.asOf) > Date.parse(current.asOf);
}

export function composeLeadKanbanColumns(
  pagesByStage: Record<LeadStage, readonly LeadKanbanResponse[]>,
): LeadKanbanViewColumn[] {
  const winners = new Map<string, Candidate>();
  const order = new Map<LeadStage, string[]>(
    leadStages.map((stage) => [stage, []]),
  );

  for (const stage of leadStages) {
    const seenInStage = new Set<string>();
    for (const response of pagesByStage[stage]) {
      const column = response.columns.find((item) => item.stage === stage);
      if (!column) continue;
      for (const item of column.items) {
        if (!seenInStage.has(item.id)) {
          order.get(stage)?.push(item.id);
          seenInStage.add(item.id);
        }
        const candidate = { item, asOf: response.asOf };
        const current = winners.get(item.id);
        if (!current || newer(candidate, current))
          winners.set(item.id, candidate);
      }
    }
  }

  return leadStages.map((stage) => {
    const pages = pagesByStage[stage];
    const latestResponse = pages.reduce<LeadKanbanResponse | undefined>(
      (latest, candidate) =>
        !latest || Date.parse(candidate.asOf) > Date.parse(latest.asOf)
          ? candidate
          : latest,
      undefined,
    );
    const finalResponse = pages.at(-1);
    const latestColumn = latestResponse?.columns.find(
      (column) => column.stage === stage,
    );
    const finalColumn = finalResponse?.columns.find(
      (column) => column.stage === stage,
    );
    const items = (order.get(stage) ?? []).flatMap((id) => {
      const winner = winners.get(id);
      return winner?.item.stage === stage ? [winner.item] : [];
    });
    return {
      stage,
      total: latestColumn?.total ?? 0,
      items,
      nextCursor: finalColumn?.page.nextCursor ?? null,
      limit: finalColumn?.page.limit ?? 20,
    };
  });
}

export function leadMoveDestinations(stage: LeadStage): LeadStage[] {
  return leadStages.filter((candidate) => candidate !== stage);
}

export function hasActiveKanbanFilters(filters: LeadKanbanFilters): boolean {
  return Object.entries(filters).some(
    ([key, value]) => key !== "limit" && value !== undefined && value !== false,
  );
}
