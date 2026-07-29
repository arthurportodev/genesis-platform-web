import { createContext, useContext } from "react";

import type {
  LeadMyActionsFilters,
  LeadReturnReviewFilters,
  LeadUnassignedFilters,
} from "@/features/leads/api/lead-contracts";
import type { LeadWorkMutationController } from "@/features/leads/hooks/use-lead-work-mutations";

export type LeadFollowUpTab = "my-actions" | "unassigned" | "return-reviews";

export interface LeadFollowUpState {
  tab: LeadFollowUpTab;
  myActionsFilters: LeadMyActionsFilters;
  unassignedFilters: LeadUnassignedFilters;
  returnReviewFilters: LeadReturnReviewFilters;
  unassignedSearch: string;
  returnReviewSearch: string;
  mutations: LeadWorkMutationController;
  setTab: (tab: LeadFollowUpTab) => void;
  setMyActionsFilters: (filters: LeadMyActionsFilters) => void;
  setUnassignedFilters: (filters: LeadUnassignedFilters) => void;
  setReturnReviewFilters: (filters: LeadReturnReviewFilters) => void;
  setUnassignedSearch: (value: string) => void;
  setReturnReviewSearch: (value: string) => void;
}

export const LeadFollowUpStateContext = createContext<LeadFollowUpState | null>(
  null,
);

export function useLeadFollowUpState(): LeadFollowUpState {
  const state = useContext(LeadFollowUpStateContext);
  if (!state) throw new Error("LeadFollowUpStateProvider ausente.");
  return state;
}
