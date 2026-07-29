import {
  leadCapabilities,
  leadWorkCapabilities,
} from "@/features/leads/api/lead-capabilities";
import type { LeadWorkItem } from "@/features/leads/api/lead-contracts";
import type { ActiveOrganization } from "@/shared/organization/active-organization";

const base = {
  status: "active",
  responsibleMembershipId: "member-a",
  returnReviewPending: true,
} as const;

it("derives capabilities without replacing backend authorization", () => {
  const member: ActiveOrganization = {
    id: "org",
    membershipId: "member-a",
    name: "Org",
    role: "member",
  };
  expect(leadCapabilities(member, base)).toMatchObject({
    canEdit: true,
    canAssign: false,
    canArchive: false,
    canDismissReturn: false,
  });
  expect(
    leadCapabilities({ ...member, membershipId: "member-b" }, base).canFollowUp,
  ).toBe(false);
  expect(leadCapabilities({ ...member, role: "owner" }, base)).toMatchObject({
    canAssign: true,
    canArchive: true,
    canDismissReturn: false,
  });
});

it("deriva ações rápidas por papel, assignment e tipo de fila", () => {
  const member: ActiveOrganization = {
    id: "org",
    membershipId: "00000000-0000-4000-8000-000000000003",
    name: "Org",
    role: "member",
  };
  const item = {
    id: "00000000-0000-4000-8000-000000000010",
    displayName: "Lead",
    companyName: null,
    responsibleMembershipId: member.membershipId,
    status: "active",
    stage: "new",
    source: "manual",
    lastEntryAt: "2026-07-29T10:00:00.000Z",
    nextAction: {
      id: "00000000-0000-4000-8000-000000000011",
      type: "call",
      description: "Ligar",
      dueAt: "2026-07-29T12:00:00.000Z",
      responsibleMembershipId: member.membershipId,
      status: "pending",
      revision: "1",
    },
    temporalState: "today",
    returnPending: false,
    revision: "3",
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  } satisfies LeadWorkItem;
  expect(
    leadWorkCapabilities(member, "my-actions", item).canManageNextAction,
  ).toBe(true);
  expect(
    leadWorkCapabilities(
      { ...member, membershipId: "00000000-0000-4000-8000-000000000099" },
      "my-actions",
      item,
    ).canManageNextAction,
  ).toBe(false);
  expect(leadWorkCapabilities(member, "unassigned", item).canAssign).toBe(
    false,
  );
});

it("closes every operational action for an unrelated member", () => {
  const capabilities = leadCapabilities(
    {
      id: "org",
      membershipId: "member-b",
      name: "Org",
      role: "member",
    },
    base,
  );
  expect(Object.values(capabilities).every((allowed) => !allowed)).toBe(true);
});

it.each(["won", "lost", "archived"] as const)(
  "allows elevated reactivation for %s Leads",
  (status) => {
    const capabilities = leadCapabilities(
      { id: "org", membershipId: "owner", name: "Org", role: "owner" },
      { ...base, status },
    );
    expect(capabilities.canReactivate).toBe(true);
    expect(capabilities.canEdit).toBe(false);
    expect(capabilities.canFollowUp).toBe(false);
    expect(capabilities.canDismissReturn).toBe(true);
  },
);

it("requires owner/admin, a closed Lead and a pending return for dismiss", () => {
  const owner: ActiveOrganization = {
    id: "org",
    membershipId: "owner",
    name: "Org",
    role: "owner",
  };
  expect(
    leadCapabilities(owner, {
      status: "won",
      responsibleMembershipId: null,
      returnReviewPending: true,
    }).canDismissReturn,
  ).toBe(true);
  expect(
    leadCapabilities(owner, {
      status: "won",
      responsibleMembershipId: null,
      returnReviewPending: false,
    }).canDismissReturn,
  ).toBe(false);
  expect(
    leadCapabilities(
      { ...owner, role: "member" },
      {
        status: "won",
        responsibleMembershipId: "owner",
        returnReviewPending: true,
      },
    ).canDismissReturn,
  ).toBe(false);
});
