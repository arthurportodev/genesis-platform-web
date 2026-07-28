import {
  createOrganizationPreferenceStore,
  resolveOrganization,
} from "@/features/organizations/organization-selection";
import { environment } from "@/shared/config/environment";

const organization = (suffix: string) => ({
  id: `00000000-0000-4000-8000-00000000000${suffix}`,
  name: `Organização ${suffix}`,
  slug: `org-${suffix}`,
  membershipId: `10000000-0000-4000-8000-00000000000${suffix}`,
  role: "member" as const,
});

describe("Organization ativa", () => {
  it("resolve zero, uma, múltiplas e preferência válida", () => {
    expect(resolveOrganization([], null)).toEqual({ kind: "none-available" });
    expect(resolveOrganization([organization("1")], null)).toMatchObject({
      kind: "selected",
      organization: organization("1"),
    });
    expect(
      resolveOrganization([organization("1"), organization("2")], null),
    ).toEqual({ kind: "selection-required" });
    expect(
      resolveOrganization(
        [organization("1"), organization("2")],
        organization("2").id,
      ),
    ).toMatchObject({ kind: "selected", organization: organization("2") });
  });

  it("persiste somente UUID válido e tolera storage indisponível", () => {
    const setItem = vi.fn();
    const storage = {
      getItem: vi.fn().mockReturnValue(organization("1").id),
      setItem,
      removeItem: vi.fn(),
    } as unknown as Storage;
    const store = createOrganizationPreferenceStore(storage);
    expect(store.read()).toBe(organization("1").id);
    store.write(organization("1").id);
    expect(setItem).toHaveBeenCalledWith(
      environment.activeOrganizationStorageKey,
      organization("1").id,
    );
    expect(() => store.write("invalid")).toThrow(/UUID válido/iu);
  });
});
