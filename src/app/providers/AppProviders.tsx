import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { AppRuntime } from "@/app/providers/runtime";
import { SessionProvider } from "@/features/auth/session/SessionProvider";
import { HttpClientProvider } from "@/shared/api/HttpClientProvider";

export function AppProviders({
  runtime,
  children,
}: {
  runtime: AppRuntime;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={runtime.queryClient}>
      <HttpClientProvider client={runtime.http}>
        <SessionProvider session={runtime.session}>{children}</SessionProvider>
      </HttpClientProvider>
    </QueryClientProvider>
  );
}
