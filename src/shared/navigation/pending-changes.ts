import { createContext, useContext, useEffect } from "react";

export interface PendingChangesContextValue {
  register: (
    hasPendingChanges: () => boolean,
    discardWarning?: string,
  ) => () => void;
  confirmDiscard: (message: string) => boolean;
}

export const PendingChangesContext =
  createContext<PendingChangesContextValue | null>(null);

export function usePendingChanges() {
  const context = useContext(PendingChangesContext);
  if (!context) throw new Error("PendingChangesProvider ausente.");
  return context;
}

export function usePendingChangesRegistration(
  hasPendingChanges: boolean,
  discardWarning?: string,
) {
  const { register } = usePendingChanges();
  useEffect(
    () => register(() => hasPendingChanges, discardWarning),
    [discardWarning, hasPendingChanges, register],
  );
}
