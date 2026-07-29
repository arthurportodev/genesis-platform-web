import {
  createAppQueryClient,
  createSessionCache,
} from "@/app/providers/queryClient";
import { queryKeys } from "@/shared/api/query-keys";

describe("createAppQueryClient", () => {
  it("aplica defaults conservadores para consultas e mutações", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries).toMatchObject({
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    });
    const retry = defaults.queries?.retry;
    expect(retry).toBeTypeOf("function");
    if (typeof retry === "function") {
      expect(retry(0, new TypeError("offline"))).toBe(true);
      expect(retry(2, new TypeError("offline"))).toBe(false);
    }
    expect(defaults.mutations).toMatchObject({ retry: 0 });
  });

  it("detecta mutation tenant pendente antes da troca de Organization", async () => {
    const client = createAppQueryClient();
    const cache = createSessionCache(client);
    const organizationId = "00000000-0000-4000-8000-000000000001";
    let finish!: () => void;
    const mutation = client.getMutationCache().build(client, {
      mutationKey: queryKeys.organization(organizationId, "lead-update"),
      mutationFn: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    const pending = mutation.execute(undefined);
    await vi.waitFor(() => {
      expect(cache.hasPendingMutations()).toBe(true);
    });
    finish();
    await pending;
    expect(cache.hasPendingMutations()).toBe(false);
  });

  it("remove mutations autenticadas ao limpar a sessão", async () => {
    const client = createAppQueryClient();
    const cache = createSessionCache(client);
    const mutation = client.getMutationCache().build(client, {
      mutationKey: queryKeys.account("profile-update"),
      mutationFn: () => Promise.resolve(),
    });
    await mutation.execute(undefined);
    expect(client.getMutationCache().getAll()).toHaveLength(1);
    await cache.cancelAndClearAuthenticated();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it("removes only mutations owned by the closed Organization", async () => {
    const client = createAppQueryClient();
    const cache = createSessionCache(client);
    const firstOrganization = "00000000-0000-4000-8000-000000000001";
    const secondOrganization = "00000000-0000-4000-8000-000000000002";
    for (const organizationId of [firstOrganization, secondOrganization]) {
      const mutation = client.getMutationCache().build(client, {
        mutationKey: queryKeys.organization(organizationId, "lead-update"),
        mutationFn: () => Promise.resolve(),
      });
      await mutation.execute(undefined);
    }

    cache.removeOrganization(firstOrganization);

    const remaining = client.getMutationCache().getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.options.mutationKey).toEqual(
      queryKeys.organization(secondOrganization, "lead-update"),
    );
  });
});
