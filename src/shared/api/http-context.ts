import { createContext, useContext } from "react";

import type { AuthenticatedHttpClient } from "@/shared/api/contracts";

export const HttpClientContext = createContext<AuthenticatedHttpClient | null>(
  null,
);

export function useHttpClient(): AuthenticatedHttpClient {
  const client = useContext(HttpClientContext);
  if (!client) throw new Error("HttpClientProvider ausente.");
  return client;
}
