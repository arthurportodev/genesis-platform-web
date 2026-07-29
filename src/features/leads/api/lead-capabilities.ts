import type { LeadDetail } from "@/features/leads/api/lead-contracts";
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
      elevated && lead.status === "active" && lead.returnReviewPending,
  };
}
