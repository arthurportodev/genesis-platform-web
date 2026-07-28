import { useContext, useSyncExternalStore } from "react";

import { SessionContext } from "@/features/auth/session/session-context";
import type { SessionCoordinator } from "@/features/auth/session/session-coordinator";

export function useSession(): {
  session: SessionCoordinator;
  state: ReturnType<SessionCoordinator["getSnapshot"]>;
} {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider ausente.");
  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
  return { session, state };
}
