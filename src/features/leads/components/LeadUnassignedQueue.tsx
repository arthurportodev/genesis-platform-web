import { useMemo } from "react";

import type { Member } from "@/features/leads/api/lead-contracts";
import {
  leadSearchMessage,
  normalizedLeadSearch,
} from "@/features/leads/api/lead-filters";
import { LeadFollowUpFilters } from "@/features/leads/components/LeadFollowUpFilters";
import { LeadWorkQueue } from "@/features/leads/components/LeadWorkQueue";
import { LeadWorkQueueItem } from "@/features/leads/components/LeadWorkQueueItem";
import { useLeadUnassignedQuery } from "@/features/leads/hooks/use-lead-work-queries";
import { useLeadFollowUpState } from "@/features/leads/model/lead-follow-up-state";
import { composeLeadWorkPages } from "@/features/leads/model/lead-work";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";

export function LeadUnassignedQueue({
  members,
}: {
  members: readonly Member[];
}) {
  const state = useLeadFollowUpState();
  const debouncedSearch = useDebouncedValue(state.unassignedSearch, 350);
  const searchReady = leadSearchMessage(debouncedSearch) === null;
  const datesReady =
    Boolean(state.unassignedFilters.createdFrom) ===
      Boolean(state.unassignedFilters.createdTo) &&
    Boolean(state.unassignedFilters.lastEntryFrom) ===
      Boolean(state.unassignedFilters.lastEntryTo);
  const queryFilters = useMemo(() => {
    const filters = { ...state.unassignedFilters };
    if (!filters.createdFrom || !filters.createdTo) {
      delete filters.createdFrom;
      delete filters.createdTo;
    }
    if (!filters.lastEntryFrom || !filters.lastEntryTo) {
      delete filters.lastEntryFrom;
      delete filters.lastEntryTo;
    }
    return { ...filters, q: normalizedLeadSearch(debouncedSearch) };
  }, [debouncedSearch, state.unassignedFilters]);
  const query = useLeadUnassignedQuery(queryFilters, searchReady && datesReady);
  const view = composeLeadWorkPages(query.data?.pages ?? []);
  const filtersActive =
    state.unassignedSearch.trim() !== "" ||
    JSON.stringify(state.unassignedFilters) !==
      JSON.stringify({ status: "active", limit: 25 });
  return (
    <div className="space-y-5">
      <LeadFollowUpFilters
        variant="unassigned"
        filters={state.unassignedFilters}
        search={state.unassignedSearch}
        searchMessage={leadSearchMessage(state.unassignedSearch)}
        members={members}
        canUseDirectory
        onSearchChange={state.setUnassignedSearch}
        onChange={state.setUnassignedFilters}
      />
      {!searchReady || !datesReady ? (
        <p
          className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
          role="status"
        >
          {!searchReady
            ? leadSearchMessage(debouncedSearch)
            : "Informe as duas datas de cada período para consultar."}
        </p>
      ) : (
        <LeadWorkQueue
          title="Sem responsável"
          description="Leads aguardando atribuição, mais recentes primeiro."
          emptyTitle={
            filtersActive
              ? "Nenhum resultado por filtro"
              : "Nenhum Lead está sem responsável"
          }
          emptyDescription="A atribuição remove o Lead desta fila após confirmação do servidor."
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
          getKey={(item) => item.id}
          renderItem={(item, index) => (
            <LeadWorkQueueItem
              variant="unassigned"
              item={item}
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
