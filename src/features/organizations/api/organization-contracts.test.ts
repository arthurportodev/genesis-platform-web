import {
  createdOrganizationSchema,
  createOrganizationInputSchema,
} from "@/features/organizations/api/organization-contracts";

describe("createOrganizationInputSchema", () => {
  it("canonicalizes the organization name without adding fields", () => {
    expect(
      createOrganizationInputSchema.parse({
        name: "  Age\u0302ncia Ge\u0301nesis  ",
      }),
    ).toEqual({ name: "Agência Génesis" });
  });

  it("rejects empty, oversized, controlled, and unknown input", () => {
    expect(
      createOrganizationInputSchema.safeParse({ name: "   " }).success,
    ).toBe(false);
    expect(
      createOrganizationInputSchema.safeParse({ name: "a".repeat(161) })
        .success,
    ).toBe(false);
    expect(
      createOrganizationInputSchema.safeParse({ name: "Genesis\nCRM" }).success,
    ).toBe(false);
    expect(
      createOrganizationInputSchema.safeParse({
        name: "Genesis",
        slug: "client-controlled",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["C0 control", "Genesis\u0000CRM"],
    ["surrogate", "Genesis\ud800CRM"],
    ["Arabic letter mark", "Genesis\u061cCRM"],
    ["left-to-right mark", "Genesis\u200eCRM"],
    ["right-to-left mark", "Genesis\u200fCRM"],
    ["line separator", "Genesis\u2028CRM"],
    ["right-to-left override", "Genesis\u202eCRM"],
    ["left-to-right isolate", "Genesis\u2066CRM"],
    ["pop directional isolate", "Genesis\u2069CRM"],
  ])("rejects the frozen forbidden-name set: %s", (_label, name) => {
    expect(createOrganizationInputSchema.safeParse({ name }).success).toBe(
      false,
    );
  });

  it("counts Unicode code points after NFC for request and response parity", () => {
    const validName = "😀".repeat(160);
    expect(createOrganizationInputSchema.parse({ name: validName })).toEqual({
      name: validName,
    });
    expect(
      createOrganizationInputSchema.safeParse({ name: `${validName}😀` })
        .success,
    ).toBe(false);
    expect(
      createdOrganizationSchema.safeParse({
        id: "10000000-0000-4000-8000-000000000001",
        name: validName,
        slug: "organizacao",
        membershipId: "10000000-0000-4000-8000-000000000002",
        role: "owner",
      }).success,
    ).toBe(true);
  });
});
