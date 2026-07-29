import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";

describe("LeadIntentKeyRegistry", () => {
  it("reuses a key only for the same uncertain payload", () => {
    const registry = new LeadIntentKeyRegistry();
    const first = registry.keyFor(
      "note",
      {
        action: "note",
        body: { content: "Primeira tentativa" },
      },
      "3",
    );
    expect(
      registry.keyFor(
        "note",
        {
          action: "note",
          body: { content: "Primeira tentativa" },
        },
        "3",
      ),
    ).toBe(first);
    expect(
      registry.keyFor(
        "note",
        {
          action: "note",
          body: { content: "Rascunho alterado" },
        },
        "3",
      ),
    ).not.toBe(first);
  });

  it("discards a key when the intent finishes or is abandoned", () => {
    const registry = new LeadIntentKeyRegistry();
    const intent = { action: "win", body: {} } as const;
    const first = registry.keyFor("win", intent, "3");
    registry.forget("win");
    expect(registry.keyFor("win", intent, "3")).not.toBe(first);
  });

  it("não reutiliza a chave quando a revisão de origem muda", () => {
    const registry = new LeadIntentKeyRegistry();
    const intent = { action: "move", body: { stage: "proposal" } } as const;
    const first = registry.keyFor("move", intent, "3");
    expect(registry.keyFor("move", intent, "4")).not.toBe(first);
  });

  it("retains a key only while the remote outcome can be uncertain", () => {
    expect(hasUncertainMutationOutcome("network")).toBe(true);
    expect(hasUncertainMutationOutcome("timeout")).toBe(true);
    expect(hasUncertainMutationOutcome("server")).toBe(false);
    expect(hasUncertainMutationOutcome("protocol")).toBe(true);
    expect(hasUncertainMutationOutcome("rate-limited")).toBe(false);
    expect(hasUncertainMutationOutcome("forbidden")).toBe(false);
    expect(hasUncertainMutationOutcome("precondition-failed")).toBe(false);
  });
});
