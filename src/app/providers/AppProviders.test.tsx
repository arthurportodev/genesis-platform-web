import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { AppProviders } from "@/app/providers/AppProviders";

function ProviderConsumer() {
  const queryClient = useQueryClient();
  return <p>Query Client: {queryClient ? "disponível" : "ausente"}</p>;
}

describe("AppProviders", () => {
  it("disponibiliza os providers principais para a árvore", () => {
    render(
      <AppProviders>
        <ProviderConsumer />
      </AppProviders>,
    );

    expect(screen.getByText("Query Client: disponível")).toBeVisible();
  });
});
