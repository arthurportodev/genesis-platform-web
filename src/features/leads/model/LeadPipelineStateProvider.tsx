import { useMemo, useState, type ReactNode } from "react";

import type {
  LeadKanbanFilters,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import { defaultLeadKanbanFilters } from "@/features/leads/api/lead-filters";
import { useLeadPipelineMove } from "@/features/leads/hooks/use-lead-mutations";
import {
  LeadPipelineStateContext,
  type LeadPipelineState,
} from "@/features/leads/model/lead-pipeline-state";

export function LeadPipelineStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LeadKanbanFilters>(
    defaultLeadKanbanFilters,
  );
  const [mobileStage, setMobileStage] = useState<LeadStage>("new");
  const [detailOrigin, setDetailOrigin] = useState<"pipeline" | null>(null);
  const move = useLeadPipelineMove();
  const value = useMemo<LeadPipelineState>(
    () => ({
      search,
      filters,
      mobileStage,
      detailOrigin,
      move,
      setSearch,
      setFilters,
      setMobileStage,
      markPipelineDetailOrigin: () => setDetailOrigin("pipeline"),
      clearDetailOrigin: () => setDetailOrigin(null),
    }),
    [detailOrigin, filters, mobileStage, move, search],
  );
  return (
    <LeadPipelineStateContext.Provider value={value}>
      {children}
    </LeadPipelineStateContext.Provider>
  );
}
