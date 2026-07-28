import { createCsrfManager, runCsrfMutation } from "@/features/auth/api/csrf";
import { AppError } from "@/shared/api/errors";

const token = "a".repeat(43);

describe("CSRF", () => {
  it("reutiliza cookie válido sem emissão", async () => {
    const request = vi.fn();
    const csrf = createCsrfManager(
      { request },
      () => `genesis_csrf_dev=${token}`,
    );
    await expect(csrf.getToken()).resolves.toBe(token);
    expect(request).not.toHaveBeenCalled();
  });

  it("emite e confirma correspondência entre body e cookie", async () => {
    let cookie = "";
    const request = vi.fn().mockImplementation(() => {
      cookie = `genesis_csrf_dev=${token}`;
      return Promise.resolve({ data: { csrfToken: token }, status: 200 });
    });
    const csrf = createCsrfManager({ request }, () => cookie);
    await expect(csrf.getToken()).resolves.toBe(token);
  });

  it("renova uma vez após 403 e encerra no segundo 403", async () => {
    const csrf = {
      getToken: vi.fn().mockResolvedValue(token),
      invalidate: vi.fn(),
    };
    const mutation = vi
      .fn()
      .mockRejectedValueOnce(new AppError("forbidden", "forbidden"))
      .mockResolvedValueOnce("ok");
    await expect(runCsrfMutation(csrf, mutation)).resolves.toBe("ok");
    expect(mutation).toHaveBeenCalledTimes(2);
    expect(csrf.invalidate).toHaveBeenCalledOnce();

    mutation.mockReset();
    mutation.mockRejectedValue(new AppError("forbidden", "forbidden"));
    await expect(runCsrfMutation(csrf, mutation)).rejects.toMatchObject({
      kind: "protocol",
    });
    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
