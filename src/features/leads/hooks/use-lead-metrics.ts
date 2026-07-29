import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { leadMetricsQueryOptions } from "@/features/leads/api/lead-query-options";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import type { LeadIdempotentAction } from "@/features/leads/api/lead-api";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import type { CanonicalMetricsPeriod } from "@/features/leads/model/lead-metrics-period";
import { toAppError } from "@/shared/api/errors";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export type MetricsAccessLoss = "forbidden" | "session";

export function invalidateLeadMetrics(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: leadQueryKeys.metricsRoot(organizationId),
  });
}

const metricsAffectingActions = new Set<LeadIdempotentAction["action"]>([
  "next-action-create",
  "next-action-reschedule",
  "next-action-complete",
  "next-action-cancel",
  "win",
  "lose",
  "archive",
  "reactivate",
  "dismiss-return",
]);

export function leadActionAffectsMetrics(
  action: LeadIdempotentAction["action"],
): boolean {
  return metricsAffectingActions.has(action);
}

export function useLeadMetrics(
  period: CanonicalMetricsPeriod,
  onAccessLost: (reason: MetricsAccessLoss) => void,
) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  const query = useQuery(leadMetricsQueryOptions(api, organization.id, period));

  useEffect(() => {
    if (!query.isError) return;
    const kind = toAppError(query.error).kind;
    if (kind === "forbidden") onAccessLost("forbidden");
    if (kind === "unauthorized" || kind === "session-expired")
      onAccessLost("session");
  }, [onAccessLost, query.error, query.isError]);

  return query;
}
