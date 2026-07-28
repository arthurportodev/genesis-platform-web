import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRuntime } from "@/app/providers/runtime";

function ProviderConsumer() {
  const queryClient = useQueryClient();
  return <p>Query Client: {queryClient ? "disponível" : "ausente"}</p>;
}

describe("AppProviders", () => {
  it("disponibiliza os providers principais para a árvore", () => {
    const runtime = createAppRuntime();
    render(
      <AppProviders runtime={runtime}>
        <ProviderConsumer />
      </AppProviders>,
    );

    expect(screen.getByText("Query Client: disponível")).toBeVisible();
    runtime.dispose();
  });
});
