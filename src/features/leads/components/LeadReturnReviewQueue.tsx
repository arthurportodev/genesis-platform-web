import { useMemo } from "react";

import type { Member } from "@/features/leads/api/lead-contracts";
import {
  leadSearchMessage,
  normalizedLeadSearch,
} from "@/features/leads/api/lead-filters";
import { LeadFollowUpFilters } from "@/features/leads/components/LeadFollowUpFilters";
import { LeadWorkQueue } from "@/features/leads/components/LeadWorkQueue";
import { LeadWorkQueueItem } from "@/features/leads/components/LeadWorkQueueItem";
import { useLeadReturnReviewsQuery } from "@/features/leads/hooks/use-lead-work-queries";
import { useLeadFollowUpState } from "@/features/leads/model/lead-follow-up-state";
import { composeLeadReturnReviewPages } from "@/features/leads/model/lead-work";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

export function LeadReturnReviewQueue({
  members,
}: {
  members: readonly Member[];
}) {
  const state = useLeadFollowUpState();
  const debouncedSearch = useDebouncedValue(state.returnReviewSearch, 350);
  const searchReady = leadSearchMessage(debouncedSearch) === null;
  const queryFilters = useMemo(
    () => ({
      ...state.returnReviewFilters,
      q: normalizedLeadSearch(debouncedSearch),
    }),
    [debouncedSearch, state.returnReviewFilters],
  );
  const query = useLeadReturnReviewsQuery(queryFilters, searchReady);
  const view = composeLeadReturnReviewPages(query.data?.pages ?? []);
  const filtersActive =
    state.returnReviewSearch.trim() !== "" ||
    state.returnReviewFilters.source !== undefined;
  return (
    <div className="space-y-5">
      <LeadFollowUpFilters
        variant="return-reviews"
        filters={state.returnReviewFilters}
        search={state.returnReviewSearch}
        searchMessage={leadSearchMessage(state.returnReviewSearch)}
        members={members}
        canUseDirectory
        onSearchChange={state.setReturnReviewSearch}
        onChange={state.setReturnReviewFilters}
      />
      {!searchReady ? (
        <p
          className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
          role="status"
        >
          {leadSearchMessage(debouncedSearch)}
        </p>
      ) : (
        <LeadWorkQueue
          title="Retornos para revisão"
          description="Novas entradas recebidas depois do encerramento, mais antigas primeiro."
          emptyTitle={
            filtersActive
              ? "Nenhum resultado por filtro"
              : "Nenhum retorno aguarda revisão"
          }
          emptyDescription="Retornos aparecem quando uma nova entrada chega após o encerramento do Lead."
          items={view.items}
          total={view.total}
          asOf={view.asOf}
          pending={query.isPending}
          error={
            query.isError && !query.isFetchNextPageError ? query.error : null
          }
          continuationError={query.isFetchNextPageError ? query.error : null}
          fetching={query.isFetching && !query.isFetchingNextPage}
          fetchingMore={query.isFetchingNextPage}
          hasMore={query.hasNextPage === true}
          onRefresh={() => void query.refetch()}
          onLoadMore={() => void query.fetchNextPage()}
          getKey={(review) => `${review.lead.id}:${review.review.id}`}
          renderItem={(review, index) => (
            <LeadWorkQueueItem
              variant="return-reviews"
              item={review.lead}
              review={review}
              members={members}
              index={index}
              controller={state.mutations}
            />
          )}
        />
      )}
    </div>
  );
}
