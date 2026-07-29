import {
  hasUncertainLeadCreationOutcome,
  LeadCreateIntentRegistry,
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

  it("vincula a chave contextual a Organization, ator, ETag e Next Action", () => {
    const registry = new LeadIntentKeyRegistry();
    const intent = {
      action: "next-action-complete",
      body: { performedAt: "2026-07-29T12:00:00.000Z" },
    } as const;
    const context = {
      organizationId: "org-a",
      actorMembershipId: "member-a",
      etag: '"opaque"',
      nextActionId: "action-a",
      nextActionRevision: "2",
    };
    const first = registry.keyFor("complete", intent, "3", context);
    expect(registry.keyFor("complete", intent, "3", context)).toBe(first);
    expect(
      registry.keyFor("complete", intent, "3", {
        ...context,
        nextActionRevision: "3",
      }),
    ).not.toBe(first);
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

describe("LeadCreateIntentRegistry", () => {
  const payload = {
    displayName: "Lead sintético",
    primaryPhone: "+5562999999999",
    source: "manual",
  } as const;

  it("vincula a chave ao tenant, ator e payload exato", () => {
    const registry = new LeadCreateIntentRegistry();
    const first = registry.begin("org-a", "actor-a", payload);
    expect(registry.begin("org-a", "actor-a", payload).key).toBe(first.key);
    expect(
      registry.begin("org-a", "actor-a", {
        ...payload,
        displayName: "Lead editado",
      }).key,
    ).not.toBe(first.key);
    expect(registry.begin("org-b", "actor-a", payload).key).not.toBe(first.key);
    expect(registry.begin("org-a", "actor-b", payload).key).not.toBe(first.key);
  });

  it("descarta a intenção sem persistência", () => {
    const registry = new LeadCreateIntentRegistry();
    registry.begin("org-a", "actor-a", payload);
    registry.forget();
    expect(registry.current()).toBeNull();
  });

  it("gera duas chaves para intenções iguais separadas por resultado determinístico", () => {
    const registry = new LeadCreateIntentRegistry();
    const first = registry.begin("org-a", "actor-a", payload).key;
    registry.forget();
    const second = registry.begin("org-a", "actor-a", payload).key;
    expect(second).not.toBe(first);
  });

  it("preserva chave para falhas que podem esconder efeito remoto", () => {
    expect(hasUncertainLeadCreationOutcome("network")).toBe(true);
    expect(hasUncertainLeadCreationOutcome("timeout")).toBe(true);
    expect(hasUncertainLeadCreationOutcome("protocol")).toBe(true);
    expect(hasUncertainLeadCreationOutcome("server")).toBe(true);
    expect(hasUncertainLeadCreationOutcome("conflict")).toBe(false);
    expect(hasUncertainLeadCreationOutcome("rate-limited")).toBe(false);
  });
});
