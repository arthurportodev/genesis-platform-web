import { createAppQueryClient } from "@/app/providers/queryClient";

describe("createAppQueryClient", () => {
  it("aplica defaults conservadores para consultas e mutações", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    });
    expect(defaults.mutations).toMatchObject({ retry: 0 });
  });
});
