import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { AppRuntime } from "@/app/providers/runtime";
import { SessionProvider } from "@/features/auth/session/SessionProvider";

export function AppProviders({
  runtime,
  children,
}: {
  runtime: AppRuntime;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={runtime.queryClient}>
      <SessionProvider session={runtime.session}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
