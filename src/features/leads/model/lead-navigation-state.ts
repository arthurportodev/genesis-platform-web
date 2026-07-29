import { createContext, useContext } from "react";

export type LeadDetailOrigin = "inbox" | "pipeline" | "follow-up";
export type LeadCreationNotice =
  | "lead-created"
  | "lead-existing-entry-recorded"
  | "lead-create-replay-confirmed"
  | "lead-submission-received";

export interface LeadNavigationState {
  detailOrigin: LeadDetailOrigin | null;
  returnScrollY: number;
  creationNotice: LeadCreationNotice | null;
  markDetailOrigin: (origin: LeadDetailOrigin, scrollY?: number) => void;
  clearDetailOrigin: () => void;
  setCreationNotice: (notice: LeadCreationNotice) => void;
  clearCreationNotice: () => void;
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
