import { expireCookie, readRecognizedCsrfCookie } from "@/shared/lib/cookies";

const names = ["__Host-genesis_csrf", "genesis_csrf_dev"] as const;
const token = "a".repeat(43);

describe("readRecognizedCsrfCookie", () => {
  it("lê os nomes de produção e desenvolvimento", () => {
    expect(
      readRecognizedCsrfCookie(`__Host-genesis_csrf=${token}`, names),
    ).toEqual({ status: "found", name: "__Host-genesis_csrf", value: token });
    expect(
      readRecognizedCsrfCookie(`genesis_csrf_dev=${token}`, names),
    ).toEqual({ status: "found", name: "genesis_csrf_dev", value: token });
  });

  it("distingue ausência de valor malformado ou duplicado", () => {
    expect(readRecognizedCsrfCookie("other=value", names)).toEqual({
      status: "missing",
    });
    expect(readRecognizedCsrfCookie("genesis_csrf_dev=curto", names)).toEqual({
      status: "invalid",
    });
    expect(
      readRecognizedCsrfCookie(
        `genesis_csrf_dev=${token}; genesis_csrf_dev=${token}`,
        names,
      ),
    ).toEqual({ status: "invalid" });
  });

  it("preserva Secure ao expirar cookie __Host- de produção", () => {
    const setter = vi.spyOn(document, "cookie", "set");
    expireCookie("__Host-genesis_csrf");
    expireCookie("genesis_csrf_dev");
    expect(setter).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("; Secure"),
    );
    expect(setter).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining("; Secure"),
    );
    setter.mockRestore();
  });
});
