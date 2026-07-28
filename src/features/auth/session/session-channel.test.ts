import { sessionMessageSchema } from "@/features/auth/session/session-channel";

describe("protocolo BroadcastChannel", () => {
  it("valida mensagens versionadas de token", () => {
    const fakeAccessToken = ["memory", "only"].join("-");
    expect(
      sessionMessageSchema.safeParse({
        version: 1,
        type: "token-updated",
        tabId: "00000000-0000-4000-8000-000000000001",
        generation: 2,
        accessToken: fakeAccessToken,
        expiresAt: Date.now() + 60_000,
      }).success,
    ).toBe(true);
  });

  it("rejeita versão, UUID, geração ou payload inválidos", () => {
    expect(
      sessionMessageSchema.safeParse({
        version: 2,
        type: "token-request",
        tabId: "invalid",
        requestId: "invalid",
        generation: -1,
      }).success,
    ).toBe(false);
    expect(
      sessionMessageSchema.safeParse({
        version: 1,
        type: "token-updated",
        tabId: "00000000-0000-4000-8000-000000000001",
        generation: 1,
        accessToken: "",
        expiresAt: 0,
      }).success,
    ).toBe(false);
  });
});
