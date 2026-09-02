import type {
  LeadKanbanResponse,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import {
  composeLeadKanbanColumns,
  composeLeadKanbanSummary,
  leadMoveDestinations,
} from "@/features/leads/model/lead-kanban";
import { testLeadListItem } from "@/test/msw/lead-handlers";

function page(
  stage: LeadStage,
  revision: string,
  asOf: string,
  nextCursor: string | null,
  total = 7,
): LeadKanbanResponse {
  return {
    asOf,
    currency: "BRL",
    expectedValueTotalMinor: "999999999999999999999999",
    withoutExpectedValue: 2,
    columns: [
      {
        stage,
        total,
        expectedValueTotalMinor: String(total * 100),
        withoutExpectedValue: 1,
        items: [testLeadListItem({ stage, revision })],
        page: { limit: 20, nextCursor },
      },
    ],
  };
}

function emptyPages(): Record<LeadStage, readonly LeadKanbanResponse[]> {
  return {
    new: [],
    qualification: [],
    diagnosis: [],
    proposal: [],
    negotiation: [],
  };
}

describe("composição paginada do Kanban", () => {
  it("deduplica por ID, prefere revisão maior e preserva total e cursor do backend", () => {
    const pages = emptyPages();
    pages.qualification = [
      page("qualification", "3", "2026-07-28T16:00:00.000Z", "opaque-1"),
      page("qualification", "5", "2026-07-28T16:01:00.000Z", null, 9),
    ];
    const column = composeLeadKanbanColumns(pages)[1];
    expect(column?.items).toHaveLength(1);
    expect(column?.items[0]?.revision).toBe("5");
    expect(column?.total).toBe(9);
    expect(column?.expectedValueTotalMinor).toBe("900");
    expect(column?.withoutExpectedValue).toBe(1);
    expect(column?.nextCursor).toBeNull();
  });

  it("desempata revisão por asOf mais recente", () => {
    const pages = emptyPages();
    pages.qualification = [
      page("qualification", "3", "2026-07-28T16:00:00.000Z", "opaque-1"),
      {
        ...page("qualification", "3", "2026-07-28T16:02:00.000Z", null),
        columns: [
          {
            ...page("qualification", "3", "2026-07-28T16:02:00.000Z", null)
              .columns[0],
            items: [
              testLeadListItem({
                stage: "qualification",
                revision: "3",
                displayName: "Mais recente",
              }),
            ],
          },
        ],
      },
    ];
    expect(composeLeadKanbanColumns(pages)[1]?.items[0]?.displayName).toBe(
      "Mais recente",
    );
  });

  it("remove o estágio atual dos destinos", () => {
    expect(leadMoveDestinations("proposal")).not.toContain("proposal");
    expect(leadMoveDestinations("proposal")).toHaveLength(4);
  });

  it("soma apenas contagens e preserva o total financeiro global do backend", () => {
    const response: LeadKanbanResponse = {
      ...page("qualification", "3", "2026-07-28T16:00:00.000Z", null, 7),
      columns: [
        {
          ...page("qualification", "3", "2026-07-28T16:00:00.000Z", null, 7)
            .columns[0],
          expectedValueTotalMinor: "100",
        },
        {
          ...page("proposal", "3", "2026-07-28T16:00:00.000Z", null, 5)
            .columns[0],
          expectedValueTotalMinor: "200",
        },
      ],
      expectedValueTotalMinor: "999999999999999999999999",
    };

    expect(composeLeadKanbanSummary(response)).toEqual({
      opportunityCount: 12,
      expectedValueTotalMinor: "999999999999999999999999",
      withoutExpectedValue: 2,
      currency: "BRL",
    });
  });
});
