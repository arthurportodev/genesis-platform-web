import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/app/providers/ErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { createAppRuntime } from "@/app/providers/runtime";
import { router } from "@/app/router/router";

export function App() {
  const [runtime] = useState(createAppRuntime);

  useEffect(() => {
    const unsubscribe = runtime.session.setLifecycleListener(() => {
      void router.invalidate();
    });
    void runtime.session.initialize();
    return () => {
      unsubscribe();
      runtime.dispose();
    };
  }, [runtime]);

  return (
    <ErrorBoundary>
      <AppProviders runtime={runtime}>
        <RouterProvider
          router={router}
          context={{ session: runtime.session }}
        />
      </AppProviders>
    </ErrorBoundary>
  );
}
