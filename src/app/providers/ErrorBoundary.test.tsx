import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ErrorBoundary } from "@/app/providers/ErrorBoundary";

function BrokenChild(): never {
  throw new Error("falha de teste");
}

describe("ErrorBoundary", () => {
  it("substitui falha de renderização por estado de erro acessível", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível exibir esta página",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Atualizar página" }),
    ).toBeVisible();
  });
});
