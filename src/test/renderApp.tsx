import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";

import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRuntime, type AppRuntime } from "@/app/providers/runtime";
import { createAppRouter } from "@/app/router/router";
import { registerTestRuntime } from "@/test/runtimeRegistry";

export async function renderAppAt(
  path: string,
  runtime: AppRuntime = createAppRuntime(),
) {
  registerTestRuntime(runtime);
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createAppRouter(history);

  const result = render(
    <AppProviders runtime={runtime}>
      <RouterProvider router={router} context={{ session: runtime.session }} />
    </AppProviders>,
  );

  await act(async () => {
    await router.load();
  });
  return { ...result, queryClient: runtime.queryClient, router, runtime };
}
