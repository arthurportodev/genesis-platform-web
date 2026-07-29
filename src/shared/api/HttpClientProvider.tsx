import type { ReactNode } from "react";

import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { HttpClientContext } from "@/shared/api/http-context";

export function HttpClientProvider({
  client,
  children,
}: {
  client: AuthenticatedHttpClient;
  children: ReactNode;
}) {
  return (
    <HttpClientContext.Provider value={client}>
      {children}
    </HttpClientContext.Provider>
  );
}
