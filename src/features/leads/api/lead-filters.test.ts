import {
  buildLeadKanbanPath,
  buildLeadMyActionsPath,
  buildLeadReturnReviewPath,
  buildLeadUnassignedPath,
  canonicalLeadKanbanFilters,
  buildLeadListPath,
  leadSearchMessage,
  nextCivilDate,
  normalizedLeadSearch,
} from "@/features/leads/api/lead-filters";

describe("filtros da Inbox", () => {
  it("normaliza busca em memória e bloqueia comprimentos fora do contrato", () => {
    expect(normalizedLeadSearch("  Jose\u0301  ")).toBe("José");
    expect(normalizedLeadSearch("ab")).toBeUndefined();
    expect(leadSearchMessage("ab")).toContain("3 caracteres");
    expect(normalizedLeadSearch("x".repeat(101))).toBeUndefined();
  });

  it("converte datas finais inclusivas com aritmética de calendário", () => {
    expect(nextCivilDate("2024-02-29")).toBe("2024-03-01");
    const path = buildLeadListPath({
      status: "active",
      sort: "createdAt:desc",
      limit: 25,
      createdTo: "2026-07-31",
    });
    expect(path).toContain("createdTo=2026-08-01");
    expect(path).toContain("status=active");
  });

  it("canonicaliza o Kanban e mantém cursor fora dos filtros", () => {
    const filters = canonicalLeadKanbanFilters({
      limit: 20,
      q: "  Jose\u0301  ",
      source: "manual",
    });
    expect(filters).toEqual({ limit: 20, q: "José", source: "manual" });
    expect(
      buildLeadKanbanPath(filters, {
        stage: "qualification",
        cursor: "opaque.value",
      }),
    ).toBe(
      "/api/v1/leads/kanban?limit=20&q=Jos%C3%A9&source=manual&stage=qualification&cursor=opaque.value",
    );
    expect(filters).not.toHaveProperty("cursor");
  });

  it("rejeita filtros de assignment incompatíveis e períodos parciais", () => {
    expect(() =>
      canonicalLeadKanbanFilters({
        limit: 20,
        assignedToMe: true,
        unassigned: true,
      }),
    ).toThrow(/mutuamente exclusivos/iu);
    expect(() =>
      buildLeadKanbanPath({ limit: 20, createdFrom: "2026-07-01" }),
    ).toThrow(/dois limites/iu);
  });
});

describe("filtros das filas operacionais", () => {
  it("mantém cursor fora dos filtros e suporta my-actions sem state", () => {
    expect(buildLeadMyActionsPath({ limit: 25 }, "opaque.cursor")).toBe(
      "/api/v1/leads/work/my-actions?limit=25&cursor=opaque.cursor",
    );
    expect(buildLeadMyActionsPath({ limit: 25, state: "today" })).toContain(
      "state=today",
    );
  });

  it("normaliza NFC e aplica os limites 3/100 da busca", () => {
    expect(
      buildLeadReturnReviewPath({ limit: 25, q: "  Jose\u0301  " }),
    ).toContain("q=Jos%C3%A9");
    expect(() => buildLeadReturnReviewPath({ limit: 25, q: "ab" })).toThrow(
      /3 e 100/iu,
    );
    expect(() =>
      buildLeadReturnReviewPath({ limit: 25, q: "x".repeat(101) }),
    ).toThrow(/3 e 100/iu);
  });

  it("constrói somente filtros autorizados da fila unassigned", () => {
    const path = buildLeadUnassignedPath({
      status: "archived",
      source: "campaign",
      nextActionState: "none",
      createdFrom: "2026-07-01",
      createdTo: "2026-07-31",
      limit: 25,
    });
    expect(path).toContain("status=archived");
    expect(path).toContain("source=campaign");
    expect(path).toContain("createdTo=2026-08-01");
    expect(path).not.toContain("assignedToMe");
  });
});
