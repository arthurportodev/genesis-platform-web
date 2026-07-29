import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  type LeadDetailSnapshot,
  type LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import type { UpdateLeadInput } from "@/features/leads/api/lead-contracts";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import type { IdempotencyKey } from "@/shared/api/idempotency";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export function useLeadMutations(leadId: string) {
  const organization = useActiveOrganization();
  const queryClient = useQueryClient();
  const api = useLeadApi();

  const refreshLead = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.root(organization.id),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.timeline(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.nextAction(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.cycles(organization.id, leadId),
      }),
    ]);
  };

  const update = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "update",
    ],
    mutationFn: ({
      current,
      body,
    }: {
      current: LeadDetailSnapshot;
      body: UpdateLeadInput;
    }) => api.update(current, body),
    onSuccess: refreshLead,
  });

  const assign = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "assign",
    ],
    mutationFn: ({
      current,
      responsibleMembershipId,
    }: {
      current: LeadDetailSnapshot;
      responsibleMembershipId: string | null;
    }) => api.assign(current, responsibleMembershipId),
    onSuccess: refreshLead,
  });

  const act = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "action",
    ],
    mutationFn: ({
      current,
      intent,
      idempotencyKey,
    }: {
      current: LeadDetailSnapshot;
      intent: LeadIdempotentAction;
      idempotencyKey: IdempotencyKey;
    }) => api.act(current, intent, idempotencyKey),
    onSuccess: refreshLead,
  });

  return { update, assign, act, refreshLead };
}
