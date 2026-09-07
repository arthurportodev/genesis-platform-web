import type {
  DynamicKanbanResponse,
  PipelineStage,
} from "@/features/leads/api/lead-contracts";
import { dynamicKanbanResponseSchema } from "@/features/leads/api/lead-contracts";
import {
  activePipelineStages,
  composeDynamicKanbanColumn,
  composeLeadKanbanSummary,
  leadMoveDestinations,
} from "@/features/leads/model/lead-kanban";
import {
  testLeadListItem,
  testPipelineId,
  testPipelineStageIds,
} from "@/test/msw/lead-handlers";

const stages = [
  {
    id: testPipelineStageIds[0],
    name: "Entrada",
    position: 0,
    archivedAt: null,
  },
  {
    id: testPipelineStageIds[1],
    name: "Análise",
    position: 1,
    archivedAt: null,
  },
  {
    id: testPipelineStageIds[2],
    name: "Antiga",
    position: 2,
    archivedAt: "2026-09-01T12:00:00.000Z",
  },
] as const satisfies readonly PipelineStage[];

function page(
  revision = "3",
  nextCursor: string | null = null,
): DynamicKanbanResponse {
  return {
    pipeline: {
      id: testPipelineId,
      name: "Comercial",
      isDefault: true,
      revision: "2",
    },
    currency: "BRL",
    expectedValueTotalMinor: "2500000",
    withoutExpectedValue: 0,
    columns: [
      {
        stage: stages[1],
        total: 1,
        expectedValueTotalMinor: "2500000",
        withoutExpectedValue: 0,
        items: [
          testLeadListItem({
            revision,
            pipelineId: testPipelineId,
            pipelineStageId: stages[1].id,
            pipelineStageName: stages[1].name,
          }),
        ],
        page: { nextCursor, limit: 20 },
      },
    ],
  };
}

it("compõe paginação por ID de etapa e preserva a revisão mais nova", () => {
  const column = composeDynamicKanbanColumn(stages[1], [
    page("3", "next"),
    page("4"),
  ]);
  expect(column.stage).toEqual(stages[1]);
  expect(column.items).toHaveLength(1);
  expect(column.items[0]?.revision).toBe("4");
  expect(column.nextCursor).toBeNull();
});

it("usa somente etapas ativas e destinos do Pipeline atual", () => {
  expect(activePipelineStages(stages).map(({ name }) => name)).toEqual([
    "Entrada",
    "Análise",
  ]);
  expect(
    leadMoveDestinations(activePipelineStages(stages), stages[0].id),
  ).toEqual([stages[1]]);
});

it("mantém totais autoritativos do agregado", () => {
  expect(composeLeadKanbanSummary(page())).toEqual({
    opportunityCount: 1,
    expectedValueTotalMinor: "2500000",
    withoutExpectedValue: 0,
    currency: "BRL",
  });
});

it("rejeita card de outro Pipeline mesmo quando a etapa coincide", () => {
  const response = page();
  response.columns[0].items[0] = {
    ...response.columns[0].items[0],
    pipelineId: "00000000-0000-4000-8000-000000000199",
  };

  expect(dynamicKanbanResponseSchema.safeParse(response).success).toBe(false);
});
