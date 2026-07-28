import {
  AppError,
  createHttpError,
  isRetryableQueryError,
} from "@/shared/api/errors";

describe("taxonomia de erros", () => {
  it("normaliza os dois formatos conhecidos do backend", () => {
    expect(
      createHttpError(400, {
        statusCode: 400,
        message: ["email must be an email"],
        error: "Bad Request",
      }),
    ).toMatchObject({
      kind: "validation",
      details: ["email must be an email"],
    });
    expect(
      createHttpError(500, {
        statusCode: 500,
        message: "Internal server error",
        path: "/api/v1/auth/bootstrap",
        timestamp: new Date().toISOString(),
      }),
    ).toMatchObject({ kind: "server", details: ["Internal server error"] });
  });

  it("não repete erros de contrato e cliente", () => {
    expect(isRetryableQueryError(new AppError("network", "offline"))).toBe(
      true,
    );
    expect(isRetryableQueryError(new AppError("timeout", "timeout"))).toBe(
      true,
    );
    expect(isRetryableQueryError(new AppError("server", "server"))).toBe(true);
    expect(isRetryableQueryError(new AppError("rate-limited", "rate"))).toBe(
      false,
    );
    expect(isRetryableQueryError(new AppError("unauthorized", "auth"))).toBe(
      false,
    );
  });
});
