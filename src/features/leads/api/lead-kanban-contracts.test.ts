import {
  leadKanbanResponseSchema,
  leadStages,
} from "@/features/leads/api/lead-contracts";
import { testLeadListItem } from "@/test/msw/lead-handlers";

function response() {
  return {
    asOf: "2026-07-28T16:00:00.000Z",
    columns: leadStages.map((stage) => ({
      stage,
      total: stage === "qualification" ? 1 : 0,
      items:
        stage === "qualification"
          ? [testLeadListItem({ stage, revision: "9223372036854775807" })]
          : [],
      page: { limit: 20, nextCursor: null },
    })),
  };
}

describe("contrato do Kanban", () => {
  it("aceita as cinco colunas, inclusive vazias, e revisão decimal", () => {
    const parsed = leadKanbanResponseSchema.parse(response());
    expect(parsed.columns.map(({ stage }) => stage)).toEqual(leadStages);
    expect(parsed.columns[0]?.items).toEqual([]);
    expect(parsed.columns[1]?.items[0]?.revision).toBe("9223372036854775807");
  });

  it("não incorpora ETag do preview ao contrato em memória", () => {
    const value = response();
    const item = value.columns[1]?.items[0];
    if (!item) throw new Error("Fixture ausente.");
    const parsed = leadKanbanResponseSchema.parse({
      ...value,
      columns: value.columns.map((column) => ({
        ...column,
        items: column.items.map((lead) => ({ ...lead, etag: '"fabricado"' })),
      })),
    });
    expect(parsed.columns[1]?.items[0]).not.toHaveProperty("etag");
  });

  it.each([
    [
      "estágio inválido",
      () => ({
        ...response(),
        columns: [{ ...response().columns[0], stage: "won" }],
      }),
    ],
    [
      "cursor vazio",
      () => ({
        ...response(),
        columns: response().columns.map((column, index) =>
          index === 0
            ? { ...column, page: { ...column.page, nextCursor: "" } }
            : column,
        ),
      }),
    ],
    [
      "Lead em coluna incompatível",
      () => ({
        ...response(),
        columns: response().columns.map((column, index) =>
          index === 0
            ? {
                ...column,
                items: [testLeadListItem({ stage: "qualification" })],
              }
            : column,
        ),
      }),
    ],
  ])("rejeita %s", (_name, invalid) => {
    expect(leadKanbanResponseSchema.safeParse(invalid()).success).toBe(false);
  });
});
