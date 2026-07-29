import { leadCapabilities } from "@/features/leads/api/lead-capabilities";
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
    canDismissReturn: true,
  });
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
  },
);
