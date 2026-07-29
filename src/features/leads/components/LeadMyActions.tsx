import type { Member } from "@/features/leads/api/lead-contracts";
import { LeadFollowUpFilters } from "@/features/leads/components/LeadFollowUpFilters";
import { LeadWorkQueue } from "@/features/leads/components/LeadWorkQueue";
import { LeadWorkQueueItem } from "@/features/leads/components/LeadWorkQueueItem";
import { useLeadMyActionsQuery } from "@/features/leads/hooks/use-lead-work-queries";
import { useLeadFollowUpState } from "@/features/leads/model/lead-follow-up-state";
import { composeLeadWorkPages } from "@/features/leads/model/lead-work";
import { useActiveOrganization } from "@/shared/organization/active-organization";

const segments = [
  { value: "overdue", label: "Atrasadas" },
  { value: "today", label: "Hoje" },
  { value: "future", label: "Futuras" },
] as const;

export function LeadMyActions({ members }: { members: readonly Member[] }) {
  const organization = useActiveOrganization();
  const state = useLeadFollowUpState();
  const query = useLeadMyActionsQuery(state.myActionsFilters);
  const view = composeLeadWorkPages(query.data?.pages ?? []);
  const selectedState = state.myActionsFilters.state ?? "overdue";
  const selectFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const last = segments.length - 1;
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % segments.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + segments.length) % segments.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = segments[nextIndex];
    state.setMyActionsFilters({
      ...state.myActionsFilters,
      state: next.value,
    });
    globalThis.setTimeout(() =>
      document.getElementById(`lead-work-temporal-tab-${next.value}`)?.focus(),
    );
  };
  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Prazo das minhas ações"
        className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
      >
        {segments.map((segment, index) => (
          <button
            key={segment.value}
            type="button"
            role="tab"
            id={`lead-work-temporal-tab-${segment.value}`}
            aria-selected={selectedState === segment.value}
            aria-controls="lead-work-temporal-panel"
            tabIndex={selectedState === segment.value ? 0 : -1}
            className="min-h-11 flex-1 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition data-[selected=true]:bg-surface data-[selected=true]:shadow-sm"
            data-selected={selectedState === segment.value}
            onClick={() =>
              state.setMyActionsFilters({
                ...state.myActionsFilters,
                state: segment.value,
              })
            }
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            {segment.label}
          </button>
        ))}
      </div>
      <LeadFollowUpFilters
        variant="my-actions"
        filters={state.myActionsFilters}
        members={members}
        canUseDirectory={organization.role !== "member"}
        onChange={state.setMyActionsFilters}
      />
      <div
        id="lead-work-temporal-panel"
        role="tabpanel"
        aria-labelledby={`lead-work-temporal-tab-${selectedState}`}
      >
        <LeadWorkQueue
          title={
            segments.find(({ value }) => value === selectedState)?.label ??
            "Ações"
          }
          description="Prioridade e ordenação definidas pelo backend no timezone CRM."
          emptyTitle={
            selectedState === "overdue"
              ? "Nenhuma ação atrasada"
              : selectedState === "today"
                ? "Você concluiu as prioridades de hoje"
                : "Nenhuma ação futura"
          }
          emptyDescription="A fila será atualizada quando houver uma próxima ação pendente."
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
              variant="my-actions"
              item={item}
              members={members}
              index={index}
              controller={state.mutations}
            />
          )}
        />
      </div>
    </div>
  );
}
import type { KeyboardEvent } from "react";
