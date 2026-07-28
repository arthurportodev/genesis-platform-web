declare const idempotencyBrand: unique symbol;
export type IdempotencyKey = string & { readonly [idempotencyBrand]: true };

export function createIdempotencyKey(): IdempotencyKey {
  return crypto.randomUUID() as IdempotencyKey;
}
