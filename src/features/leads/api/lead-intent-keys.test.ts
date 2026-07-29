import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";

describe("LeadIntentKeyRegistry", () => {
  it("reuses a key only for the same uncertain payload", () => {
    const registry = new LeadIntentKeyRegistry();
    const first = registry.keyFor("note", {
      action: "note",
      body: { content: "Primeira tentativa" },
    });
    expect(
      registry.keyFor("note", {
        action: "note",
        body: { content: "Primeira tentativa" },
      }),
    ).toBe(first);
    expect(
      registry.keyFor("note", {
        action: "note",
        body: { content: "Rascunho alterado" },
      }),
    ).not.toBe(first);
  });

  it("discards a key when the intent finishes or is abandoned", () => {
    const registry = new LeadIntentKeyRegistry();
    const intent = { action: "win", body: {} } as const;
    const first = registry.keyFor("win", intent);
    registry.forget("win");
    expect(registry.keyFor("win", intent)).not.toBe(first);
  });

  it("retains a key only while the remote outcome can be uncertain", () => {
    expect(hasUncertainMutationOutcome("network")).toBe(true);
    expect(hasUncertainMutationOutcome("timeout")).toBe(true);
    expect(hasUncertainMutationOutcome("server")).toBe(true);
    expect(hasUncertainMutationOutcome("protocol")).toBe(true);
    expect(hasUncertainMutationOutcome("rate-limited")).toBe(false);
    expect(hasUncertainMutationOutcome("forbidden")).toBe(false);
    expect(hasUncertainMutationOutcome("precondition-failed")).toBe(false);
  });
});
