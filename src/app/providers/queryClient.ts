import { QueryClient } from "@tanstack/react-query";

import { isRetryableQueryError } from "@/shared/api/errors";
import {
  isAuthenticatedQueryKey,
  isOrganizationQueryKey,
} from "@/shared/api/query-keys";
import type { SessionCache } from "@/features/auth/session/session-coordinator";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) =>
          failureCount < 2 && isRetryableQueryError(error),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function createSessionCache(queryClient: QueryClient): SessionCache {
  return {
    cancelAndClearAuthenticated() {
      void queryClient.cancelQueries({
        predicate: ({ queryKey }) => isAuthenticatedQueryKey(queryKey),
      });
      queryClient.removeQueries({
        predicate: ({ queryKey }) => isAuthenticatedQueryKey(queryKey),
      });
      const mutationCache = queryClient.getMutationCache();
      for (const mutation of mutationCache.getAll()) {
        if (isAuthenticatedQueryKey(mutation.options.mutationKey ?? []))
          mutationCache.remove(mutation);
      }
      return Promise.resolve();
    },
    hasPendingMutations() {
      return queryClient.isMutating() > 0;
    },
    async cancelOrganization(organizationId) {
      await queryClient.cancelQueries({
        predicate: ({ queryKey }) =>
          isOrganizationQueryKey(queryKey, organizationId),
      });
    },
    removeOrganization(organizationId) {
      queryClient.removeQueries({
        predicate: ({ queryKey }) =>
          isOrganizationQueryKey(queryKey, organizationId),
      });
      const mutationCache = queryClient.getMutationCache();
      for (const mutation of mutationCache.getAll()) {
        if (
          isOrganizationQueryKey(
            mutation.options.mutationKey ?? [],
            organizationId,
          )
        )
          mutationCache.remove(mutation);
      }
    },
  };
}
