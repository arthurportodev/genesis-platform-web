export const queryKeys = {
  public: <T extends readonly unknown[]>(resource: string, ...parameters: T) =>
    ["public", resource, ...parameters] as const,
  account: <T extends readonly unknown[]>(resource: string, ...parameters: T) =>
    ["account", resource, ...parameters] as const,
  organization: <T extends readonly unknown[]>(
    organizationId: string,
    resource: string,
    ...parameters: T
  ) => ["organization", organizationId, resource, ...parameters] as const,
};

export function isAuthenticatedQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === "account" || queryKey[0] === "organization";
}

export function isOrganizationQueryKey(
  queryKey: readonly unknown[],
  organizationId?: string,
): boolean {
  return (
    queryKey[0] === "organization" &&
    (organizationId === undefined || queryKey[1] === organizationId)
  );
}
