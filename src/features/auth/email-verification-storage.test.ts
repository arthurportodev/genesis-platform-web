import {
  clearVerificationContinuation,
  readVerificationContinuation,
  writeVerificationContinuation,
} from "@/features/auth/email-verification-storage";

const continuation = {
  challengeId: "10000000-0000-4000-8000-000000000001",
  expiresAt: "2030-01-01T00:10:00.000Z",
  resendAvailableAt: "2030-01-01T00:01:00.000Z",
};

describe("contexto de verificação", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("persiste somente o contrato mínimo validado e o remove explicitamente", () => {
    writeVerificationContinuation(continuation, "sent");
    const raw = window.sessionStorage.getItem("genesis.emailVerification.v1");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("accessToken");
    expect(readVerificationContinuation(Date.parse("2029-01-01"))).toEqual({
      version: 1,
      ...continuation,
      delivery: "sent",
    });
    clearVerificationContinuation();
    expect(readVerificationContinuation()).toBeNull();
  });

  it("descarta conteúdo arbitrário e contexto expirado", () => {
    window.sessionStorage.setItem(
      "genesis.emailVerification.v1",
      JSON.stringify({ version: 1, ...continuation, password: "forbidden" }),
    );
    expect(readVerificationContinuation(Date.parse("2029-01-01"))).toBeNull();
    writeVerificationContinuation(continuation);
    expect(readVerificationContinuation(Date.parse("2031-01-01"))).toBeNull();
  });
});
