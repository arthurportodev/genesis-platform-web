import type {
  LeadDetail,
  LeadWorkItem,
} from "@/features/leads/api/lead-contracts";
import type { ActiveOrganization } from "@/shared/organization/active-organization";

export interface LeadCapabilities {
  canEdit: boolean;
  canAssign: boolean;
  canFollowUp: boolean;
  canMove: boolean;
  canClose: boolean;
  canArchive: boolean;
  canReactivate: boolean;
  canDismissReturn: boolean;
}

export function leadWorkCapabilities(
  organization: ActiveOrganization,
  queue: "my-actions" | "unassigned" | "return-reviews",
  lead: LeadWorkItem,
) {
  const elevated =
    organization.role === "owner" || organization.role === "admin";
  const ownsLead =
    lead.responsibleMembershipId === organization.membershipId &&
    lead.nextAction?.responsibleMembershipId === organization.membershipId;
  const pendingAction =
    lead.status === "active" && lead.nextAction?.status === "pending";
  return {
    canManageNextAction:
      queue === "my-actions" && pendingAction && (elevated || ownsLead),
    canAssign:
      queue === "unassigned" &&
      elevated &&
      lead.status === "active" &&
      lead.responsibleMembershipId === null,
    canDismissReturn:
      queue === "return-reviews" &&
      elevated &&
      lead.status !== "active" &&
      lead.returnPending,
  };
}

export function leadCapabilities(
  organization: ActiveOrganization,
  lead: Pick<
    LeadDetail,
    "status" | "responsibleMembershipId" | "returnReviewPending"
  >,
): LeadCapabilities {
  const elevated =
    organization.role === "owner" || organization.role === "admin";
  const memberOwnsLead =
    organization.role === "member" &&
    lead.responsibleMembershipId === organization.membershipId;
  const operational = elevated || memberOwnsLead;
  return {
    canEdit: operational && lead.status === "active",
    canAssign: elevated && lead.status === "active",
    canFollowUp: operational && lead.status === "active",
    canMove: operational && lead.status === "active",
    canClose: operational && lead.status === "active",
    canArchive: elevated && lead.status === "active",
    canReactivate: elevated && lead.status !== "active",
    canDismissReturn:
      elevated && lead.status !== "active" && lead.returnReviewPending,
  };
}
