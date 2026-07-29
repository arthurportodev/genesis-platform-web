import { useCallback, useMemo, useRef, type ReactNode } from "react";

import { PendingChangesContext } from "@/shared/navigation/pending-changes";

export function PendingChangesProvider({ children }: { children: ReactNode }) {
  const guards = useRef(
    new Map<
      symbol,
      { hasPendingChanges: () => boolean; discardWarning?: string }
    >(),
  );
  const register = useCallback(
    (hasPendingChanges: () => boolean, discardWarning?: string) => {
      const id = Symbol("pending-changes");
      guards.current.set(id, { hasPendingChanges, discardWarning });
      return () => guards.current.delete(id);
    },
    [],
  );
  const confirmDiscard = useCallback((message: string) => {
    const pending = [...guards.current.values()].filter((guard) =>
      guard.hasPendingChanges(),
    );
    if (pending.length === 0) return true;
    const warning = pending.find(
      (guard) => guard.discardWarning,
    )?.discardWarning;
    return globalThis.confirm(warning ?? message);
  }, []);
  const value = useMemo(
    () => ({ register, confirmDiscard }),
    [confirmDiscard, register],
  );
  return (
    <PendingChangesContext.Provider value={value}>
      {children}
    </PendingChangesContext.Provider>
  );
}
