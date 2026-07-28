const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/u;

export type CookieReadResult =
  | { status: "found"; name: string; value: string }
  | { status: "missing" }
  | { status: "invalid" };

export function readRecognizedCsrfCookie(
  cookieHeader: string,
  recognizedNames: readonly string[],
): CookieReadResult {
  const values: Array<{ name: string; value: string }> = [];
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim();
    if (!recognizedNames.includes(name)) continue;
    try {
      const value = decodeURIComponent(segment.slice(separator + 1).trim());
      values.push({ name, value });
    } catch {
      return { status: "invalid" };
    }
  }
  if (values.length === 0) return { status: "missing" };
  if (values.length !== 1 || !BASE64URL_43.test(values[0].value))
    return { status: "invalid" };
  return { status: "found", ...values[0] };
}

export function expireCookie(name: string): void {
  const secure = name.startsWith("__Host-") ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}
