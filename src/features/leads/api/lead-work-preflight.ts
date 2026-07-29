import type {
  LeadDetailSnapshot,
  LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import type {
  LeadReturnReviewItem,
  LeadWorkItem,
} from "@/features/leads/api/lead-contracts";
import { AppError } from "@/shared/api/errors";

export type LeadWorkNextActionIntent = Extract<
  LeadIdempotentAction,
  {
    action:
      "next-action-complete" | "next-action-reschedule" | "next-action-cancel";
  }
>;

export function compatibleWorkDetail(
  current: LeadDetailSnapshot,
  item: LeadWorkItem,
): boolean {
  return (
    current.lead.id === item.id &&
    current.snapshot.leadId === item.id &&
    current.lead.revision === item.revision &&
    current.snapshot.revision === item.revision
  );
}

export function assertNextActionPreflight(
  current: LeadDetailSnapshot,
  item: LeadWorkItem,
): void {
  if (!compatibleWorkDetail(current, item))
    throw new AppError("precondition-failed", "O Lead mudou.");
  const expected = item.nextAction;
  const actual = current.lead.nextAction;
  if (
    item.status !== "active" ||
    !expected ||
    expected.status !== "pending" ||
    !actual ||
    actual.status !== "pending" ||
    actual.id !== expected.id ||
    actual.revision !== expected.revision ||
    actual.responsibleMembershipId !== expected.responsibleMembershipId
  )
    throw new AppError(
      "precondition-failed",
      "A próxima ação mudou. Revise a fila.",
    );
}

export function assertAssignmentPreflight(
  current: LeadDetailSnapshot,
  item: LeadWorkItem,
  responsibleMembershipId: string,
  allowedMembershipIds: ReadonlySet<string>,
): void {
  if (
    !compatibleWorkDetail(current, item) ||
    current.lead.status !== "active" ||
    current.lead.responsibleMembershipId !== null ||
    !allowedMembershipIds.has(responsibleMembershipId)
  )
    throw new AppError(
      "precondition-failed",
      "O Lead ou o responsável disponível mudou. Revise a fila.",
    );
}

export function assertDismissPreflight(
  current: LeadDetailSnapshot,
  item: LeadReturnReviewItem,
): void {
  if (
    !compatibleWorkDetail(current, item.lead) ||
    current.lead.status === "active" ||
    !current.lead.returnReviewPending ||
    current.lead.pendingReturn?.id !== item.review.id ||
    current.lead.pendingReturn.cycleId !== item.review.cycleId
  )
    throw new AppError(
      "precondition-failed",
      "A revisão de retorno mudou. Revise a fila.",
    );
}
