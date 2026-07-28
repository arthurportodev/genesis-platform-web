import { safeReturnTo } from "@/shared/lib/safe-return-to";

describe("safeReturnTo", () => {
  it.each(["/app", "/app/leads", "/app/leads?id=1"])(
    "aceita path administrativo interno %s",
    (path) => expect(safeReturnTo(path)).toBe(path),
  );

  it.each([
    "https://evil.test/app",
    "//evil.test",
    "/app\\evil",
    "/login",
    "/select-organization",
    "/access-denied",
    "/app\u0000evil",
  ])("rejeita retorno inseguro %s", (path) => {
    expect(safeReturnTo(path)).toBeUndefined();
  });
});
