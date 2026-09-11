import { OrganizationCreationIntentRegistry } from "@/features/organizations/api/organization-creation-intent";

describe("OrganizationCreationIntentRegistry", () => {
  it("preserves the key for a retry of the same canonical name", () => {
    const registry = new OrganizationCreationIntentRegistry();
    const first = registry.begin({ name: " Agência Gênesis " });
    expect(registry.begin({ name: "Agência Gênesis" }).key).toBe(first.key);
  });

  it("starts a new intention after the user changes the attempted name", () => {
    const registry = new OrganizationCreationIntentRegistry();
    const first = registry.begin({ name: "Agência Gênesis" });
    registry.forgetIfNameChanged("Outra organização");
    expect(registry.begin({ name: "Agência Gênesis" }).key).not.toBe(first.key);
  });

  it("forgets a completed intention", () => {
    const registry = new OrganizationCreationIntentRegistry();
    const first = registry.begin({ name: "Agência Gênesis" });
    registry.forget();
    expect(registry.begin({ name: "Agência Gênesis" }).key).not.toBe(first.key);
  });
});
