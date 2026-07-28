import { render, screen } from "@testing-library/react";

import { OperationalState } from "@/shared/components/OperationalState";

describe("OperationalState", () => {
  it("expõe carregamento por uma região viva", () => {
    render(
      <OperationalState
        kind="loading"
        title="Carregando dados"
        description="Aguarde a conclusão."
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Carregando dados")).toBeVisible();
  });

  it.each([
    ["empty", "Nenhum resultado"],
    ["error", "Não foi possível carregar"],
    ["unavailable", "Recurso indisponível"],
  ] as const)("renderiza o estado %s", (kind, title) => {
    render(
      <OperationalState
        kind={kind}
        title={title}
        description="Descrição operacional honesta."
      />,
    );

    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByText("Descrição operacional honesta.")).toBeVisible();
  });
});
