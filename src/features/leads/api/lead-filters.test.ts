import {
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
});
