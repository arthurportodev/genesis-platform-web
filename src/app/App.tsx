import { RouterProvider } from "@tanstack/react-router";

import { ErrorBoundary } from "@/app/providers/ErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { router } from "@/app/router/router";

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
