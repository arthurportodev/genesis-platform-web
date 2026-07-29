import { createContext, useContext } from "react";

export type LeadDetailOrigin = "inbox" | "pipeline" | "follow-up";

export interface LeadNavigationState {
  detailOrigin: LeadDetailOrigin | null;
  returnScrollY: number;
  markDetailOrigin: (origin: LeadDetailOrigin, scrollY?: number) => void;
  clearDetailOrigin: () => void;
}

export const LeadNavigationStateContext =
  createContext<LeadNavigationState | null>(null);

export function useLeadNavigationState(): LeadNavigationState {
  const state = useContext(LeadNavigationStateContext);
  if (!state) throw new Error("LeadNavigationStateProvider ausente.");
  return state;
}

export function useOptionalLeadNavigationState(): LeadNavigationState | null {
  return useContext(LeadNavigationStateContext);
}
