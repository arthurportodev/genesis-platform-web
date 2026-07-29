import { createContext, useContext } from "react";

import type {
  LeadKanbanFilters,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import type { LeadPipelineMoveController } from "@/features/leads/hooks/use-lead-mutations";

export interface LeadPipelineState {
  search: string;
  filters: LeadKanbanFilters;
  mobileStage: LeadStage;
  detailOrigin: "pipeline" | null;
  move: LeadPipelineMoveController;
  setSearch: (value: string) => void;
  setFilters: (value: LeadKanbanFilters) => void;
  setMobileStage: (value: LeadStage) => void;
  markPipelineDetailOrigin: () => void;
  clearDetailOrigin: () => void;
}

export const LeadPipelineStateContext = createContext<LeadPipelineState | null>(
  null,
);

export function useLeadPipelineState(): LeadPipelineState {
  const state = useContext(LeadPipelineStateContext);
  if (!state) throw new Error("LeadPipelineStateProvider ausente.");
  return state;
}

export function useOptionalLeadPipelineState(): LeadPipelineState | null {
  return useContext(LeadPipelineStateContext);
}
