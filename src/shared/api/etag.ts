declare const etagBrand: unique symbol;
export type EntityTag = string & { readonly [etagBrand]: true };

export function asEntityTag(value: string | undefined): EntityTag | undefined {
  return value === undefined ? undefined : (value as EntityTag);
}
