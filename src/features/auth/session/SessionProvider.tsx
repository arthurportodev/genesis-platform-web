import type { ReactNode } from "react";

import { SessionContext } from "@/features/auth/session/session-context";
import type { SessionCoordinator } from "@/features/auth/session/session-coordinator";

export function SessionProvider({
  session,
  children,
}: {
  session: SessionCoordinator;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
