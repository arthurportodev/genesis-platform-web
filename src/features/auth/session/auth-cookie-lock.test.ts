import { createAuthCookieLock } from "@/features/auth/session/auth-cookie-lock";

describe("AuthCookieLock", () => {
  it("executa explicitamente sem Web Locks, mas reporta fallback", async () => {
    const lock = createAuthCookieLock(undefined);
    const operation = vi.fn().mockResolvedValue("ok");
    expect(lock.available).toBe(false);
    await expect(lock.run(operation)).resolves.toBe("ok");
  });

  it("usa nome e modo exclusivos canônicos", async () => {
    const request = vi.fn(
      (
        _name: string,
        _options: LockOptions,
        callback: (lock: Lock) => Promise<string>,
      ) => callback({ name: "genesis.auth-cookie.v1", mode: "exclusive" }),
    );
    const lock = createAuthCookieLock({ request } as unknown as LockManager);
    await expect(lock.run(() => Promise.resolve("ok"))).resolves.toBe("ok");
    expect(request).toHaveBeenCalledWith(
      "genesis.auth-cookie.v1",
      expect.objectContaining({ mode: "exclusive" }),
      expect.any(Function),
    );
  });

  it("timeout cancela aquisição e nunca autoriza operação concorrente", async () => {
    const request = vi.fn(
      (
        _name: string,
        options: LockOptions,
        callback: (lock: Lock) => Promise<string>,
      ) => {
        void callback;
        return new Promise<string>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Abort", "AbortError")),
          );
        });
      },
    );
    const operation = vi.fn().mockResolvedValue("unsafe");
    await expect(
      createAuthCookieLock({ request } as unknown as LockManager).run(
        operation,
        1,
      ),
    ).rejects.toMatchObject({ kind: "timeout" });
    expect(operation).not.toHaveBeenCalled();
  });
});
