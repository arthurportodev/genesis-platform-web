function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

export function safeReturnTo(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/app") ||
    (value !== "/app" && !value.startsWith("/app/")) ||
    value.startsWith("//") ||
    value.includes("\\") ||
    containsControlCharacter(value) ||
    /^[a-z][a-z\d+.-]*:/iu.test(value)
  ) {
    return undefined;
  }
  return value;
}
