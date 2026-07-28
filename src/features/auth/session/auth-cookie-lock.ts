import { AppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";

export interface AuthCookieLock {
  readonly available: boolean;
  run<T>(operation: () => Promise<T>, timeoutMs?: number): Promise<T>;
}

export function createAuthCookieLock(
  lockManager: LockManager | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.locks,
): AuthCookieLock {
  return {
    available: lockManager !== undefined,
    async run<T>(operation: () => Promise<T>, timeoutMs = 5_000): Promise<T> {
      if (!lockManager) return operation();
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(
        () => controller.abort(new DOMException("Timeout", "TimeoutError")),
        timeoutMs,
      );
      try {
        return await lockManager.request(
          environment.authCookieLockName,
          { mode: "exclusive", signal: controller.signal },
          operation,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw new AppError(
            "timeout",
            "Não foi possível coordenar a renovação da sessão.",
            { cause: error },
          );
        }
        throw error;
      } finally {
        globalThis.clearTimeout(timeout);
      }
    },
  };
}
