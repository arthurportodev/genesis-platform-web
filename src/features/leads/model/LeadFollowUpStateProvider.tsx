import { useMemo, useState, type ReactNode } from "react";

import type {
  LeadMyActionsFilters,
  LeadReturnReviewFilters,
  LeadUnassignedFilters,
} from "@/features/leads/api/lead-contracts";
import {
  defaultLeadMyActionsFilters,
  defaultLeadReturnReviewFilters,
  defaultLeadUnassignedFilters,
} from "@/features/leads/api/lead-filters";
import {
  LeadFollowUpStateContext,
  type LeadFollowUpTab,
} from "@/features/leads/model/lead-follow-up-state";
import { useLeadWorkMutations } from "@/features/leads/hooks/use-lead-work-mutations";

export function LeadFollowUpStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const mutations = useLeadWorkMutations();
  const [tab, setTab] = useState<LeadFollowUpTab>("my-actions");
  const [myActionsFilters, setMyActionsFilters] =
    useState<LeadMyActionsFilters>(defaultLeadMyActionsFilters);
  const [unassignedFilters, setUnassignedFilters] =
    useState<LeadUnassignedFilters>(defaultLeadUnassignedFilters);
  const [returnReviewFilters, setReturnReviewFilters] =
    useState<LeadReturnReviewFilters>(defaultLeadReturnReviewFilters);
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [returnReviewSearch, setReturnReviewSearch] = useState("");
  const value = useMemo(
    () => ({
      tab,
      myActionsFilters,
      unassignedFilters,
      returnReviewFilters,
      unassignedSearch,
      returnReviewSearch,
      mutations,
      setTab,
      setMyActionsFilters,
      setUnassignedFilters,
      setReturnReviewFilters,
      setUnassignedSearch,
      setReturnReviewSearch,
    }),
    [
      myActionsFilters,
      mutations,
      returnReviewFilters,
      returnReviewSearch,
      tab,
      unassignedFilters,
      unassignedSearch,
    ],
  );
  return (
    <LeadFollowUpStateContext.Provider value={value}>
      {children}
    </LeadFollowUpStateContext.Provider>
  );
}
