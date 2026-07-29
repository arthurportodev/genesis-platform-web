import { useEffect, useMemo, type KeyboardEvent } from "react";

import { LeadMyActions } from "@/features/leads/components/LeadMyActions";
import { LeadReturnReviewQueue } from "@/features/leads/components/LeadReturnReviewQueue";
import { LeadUnassignedQueue } from "@/features/leads/components/LeadUnassignedQueue";
import { LeadWorkFeedback } from "@/features/leads/components/LeadWorkFeedback";
import { useLeadAssigneesQuery } from "@/features/leads/hooks/use-lead-queries";
import {
  useLeadFollowUpState,
  type LeadFollowUpTab,
} from "@/features/leads/model/lead-follow-up-state";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { PageHeader } from "@/shared/components/PageHeader";
import { useActiveOrganization } from "@/shared/organization/active-organization";

const tabs: Array<{
  value: LeadFollowUpTab;
  label: string;
  elevated: boolean;
}> = [
  { value: "my-actions", label: "Minhas ações", elevated: false },
  { value: "unassigned", label: "Sem responsável", elevated: true },
  { value: "return-reviews", label: "Retornos para revisão", elevated: true },
];

export function LeadFollowUpPage() {
  const organization = useActiveOrganization();
  const state = useLeadFollowUpState();
  const navigation = useLeadNavigationState();
  const elevated =
    organization.role === "owner" || organization.role === "admin";
  const visibleTabs = tabs.filter((tab) => !tab.elevated || elevated);
  const assignees = useLeadAssigneesQuery(elevated);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );

  useEffect(() => {
    if (!elevated && state.tab !== "my-actions") state.setTab("my-actions");
  }, [elevated, state]);

  useEffect(() => {
    if (navigation.detailOrigin !== "follow-up") return;
    const scrollY = navigation.returnScrollY;
    globalThis.setTimeout(() => globalThis.scrollTo?.({ top: scrollY }), 0);
  }, [navigation.detailOrigin, navigation.returnScrollY]);

  const activeTab =
    !elevated && state.tab !== "my-actions" ? "my-actions" : state.tab;
  const selectTabFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const last = visibleTabs.length - 1;
    const nextIndex =
      event.key === "ArrowRight"
        ? (currentIndex + 1) % visibleTabs.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + visibleTabs.length) % visibleTabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = visibleTabs[nextIndex];
    state.setTab(next.value);
    globalThis.setTimeout(() =>
      document.getElementById(`lead-work-tab-${next.value}`)?.focus(),
    );
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação diária"
        title="Follow-up"
        description="Priorize o que precisa ser feito agora na Organization ativa."
      />

      <LeadWorkFeedback controller={state.mutations} />

      <div
        role="tablist"
        aria-label="Filas operacionais"
        className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
      >
        {visibleTabs.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`lead-work-tab-${tab.value}`}
            aria-selected={activeTab === tab.value}
            aria-controls={`lead-work-panel-${tab.value}`}
            tabIndex={activeTab === tab.value ? 0 : -1}
            data-selected={activeTab === tab.value}
            className="min-h-11 shrink-0 rounded-md px-4 text-sm font-semibold text-muted-foreground transition data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
            onClick={() => state.setTab(tab.value)}
            onKeyDown={(event) => selectTabFromKeyboard(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {elevated && assignees.isError ? (
        <p
          className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
          role="status"
        >
          O diretório de responsáveis está indisponível. As filas permanecem
          visíveis, mas atribuições ficam desabilitadas.
        </p>
      ) : null}

      <div
        id={`lead-work-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`lead-work-tab-${activeTab}`}
      >
        {activeTab === "my-actions" ? (
          <LeadMyActions members={members} />
        ) : null}
        {activeTab === "unassigned" && elevated ? (
          <LeadUnassignedQueue members={members} />
        ) : null}
        {activeTab === "return-reviews" && elevated ? (
          <LeadReturnReviewQueue members={members} />
        ) : null}
      </div>
    </div>
  );
}
