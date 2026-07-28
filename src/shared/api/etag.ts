declare const etagBrand: unique symbol;
export type EntityTag = string & { readonly [etagBrand]: true };

export function asEntityTag(value: string | undefined): EntityTag | undefined {
  return value === undefined ? undefined : (value as EntityTag);
}

export function ifMatchHeader(
  etag: EntityTag,
): Readonly<Record<string, string>> {
  return { "If-Match": etag };
}
