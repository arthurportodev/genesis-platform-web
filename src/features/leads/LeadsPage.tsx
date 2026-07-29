import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { LeadListFilters } from "@/features/leads/api/lead-contracts";
import {
  defaultLeadFilters,
  leadSearchMessage,
  normalizedLeadSearch,
} from "@/features/leads/api/lead-filters";
import { LeadInboxFilters } from "@/features/leads/components/LeadInboxFilters";
import { LeadInboxList } from "@/features/leads/components/LeadInboxList";
import {
  useLeadAssigneesQuery,
  useLeadInboxQuery,
} from "@/features/leads/hooks/use-lead-queries";
import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { toAppError } from "@/shared/api/errors";
import { useDebouncedValue } from "@/shared/lib/use-debounced-value";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";
import { buttonVariants } from "@/shared/ui/Button";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { cn } from "@/shared/lib/cn";

function inboxErrorMessage(error: unknown): string {
  const appError = toAppError(error);
  if (appError.kind === "forbidden")
    return "Seu papel não permite consultar esta seleção de Leads.";
  if (appError.kind === "rate-limited")
    return "A Inbox recebeu muitas consultas. Aguarde um instante e tente novamente.";
  if (appError.kind === "server")
    return "A leitura operacional está temporariamente indisponível.";
  return appError.message;
}

export function LeadsPage() {
  const organization = useActiveOrganization();
  const navigation = useLeadNavigationState();
  const [creationNotice] = useState(navigation.creationNotice);
  useEffect(() => {
    if (creationNotice) navigation.clearCreationNotice();
  }, [creationNotice, navigation]);
  const canUseDirectory =
    organization.role === "owner" || organization.role === "admin";
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const searchMessage = leadSearchMessage(search);
  const [filters, setFilters] = useState<LeadListFilters>(defaultLeadFilters);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const currentCursor = cursorStack.at(-1);
  const normalizedSearch = normalizedLeadSearch(debouncedSearch);
  const queryFilters = useMemo(
    () => ({ ...filters, q: normalizedSearch }),
    [filters, normalizedSearch],
  );
  const searchCanQuery = leadSearchMessage(debouncedSearch) === null;
  const inbox = useLeadInboxQuery(queryFilters, currentCursor, searchCanQuery);
  const assignees = useLeadAssigneesQuery(canUseDirectory);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );

  const changeFilters = (next: LeadListFilters) => {
    setFilters(next);
    setCursorStack([undefined]);
  };
  const data = inbox.data;
  const hasActiveFilters =
    search.trim() !== "" ||
    JSON.stringify(filters) !== JSON.stringify(defaultLeadFilters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relacionamento"
        title="Inbox de Leads"
        description="Consulte oportunidades da Organization ativa, priorize a próxima ação e abra o histórico operacional."
        action={
          <Link
            to="/app/leads/new"
            className={cn(buttonVariants(), "min-h-11")}
          >
            <Plus className="size-4" aria-hidden="true" /> Novo Lead
          </Link>
        }
      />

      {creationNotice === "lead-submission-received" ? (
        <p
          className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          Solicitação processada.
        </p>
      ) : null}

      <LeadInboxFilters
        search={search}
        searchMessage={searchMessage}
        filters={filters}
        members={members}
        canUseDirectory={canUseDirectory}
        hasMoreMembers={assignees.hasNextPage === true}
        loadingMoreMembers={assignees.isFetchingNextPage}
        onLoadMoreMembers={() => void assignees.fetchNextPage()}
        onSearchChange={(value) => {
          setSearch(value);
          setCursorStack([undefined]);
        }}
        onFiltersChange={changeFilters}
      />

      {!searchCanQuery ? (
        <OperationalState
          kind="empty"
          compact
          title="Complete a busca"
          description={
            leadSearchMessage(debouncedSearch) ?? "Revise a busca informada."
          }
        />
      ) : inbox.isPending ? (
        <OperationalState
          kind="loading"
          compact
          title="Carregando Leads"
          description="Consultando a Inbox da Organization ativa."
        />
      ) : inbox.isError ? (
        <section
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
          role="alert"
        >
          <h2 className="font-semibold">Não foi possível carregar a Inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {inboxErrorMessage(inbox.error)}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => void inbox.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Tentar novamente
          </Button>
        </section>
      ) : data && data.items.length === 0 ? (
        <OperationalState
          kind="empty"
          title={hasActiveFilters ? "Nenhum Lead encontrado" : "Inbox vazia"}
          description={
            hasActiveFilters
              ? "Nenhum Lead corresponde aos filtros atuais."
              : "Ainda não existem Leads ativos nesta Organization."
          }
        />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">{data.page.total}</strong>{" "}
              Leads na seleção · atualização{" "}
              {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
                new Date(data.page.asOf),
              )}
            </p>
            {inbox.isFetching ? <span role="status">Atualizando…</span> : null}
          </div>
          <LeadInboxList
            items={data.items}
            members={members}
            currentMembershipId={organization.membershipId}
          />
          <nav
            className="flex items-center justify-between"
            aria-label="Paginação da Inbox"
          >
            <Button
              variant="secondary"
              disabled={cursorStack.length === 1 || inbox.isFetching}
              onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {cursorStack.length}
            </span>
            <Button
              variant="secondary"
              disabled={!data.page.nextCursor || inbox.isFetching}
              onClick={() =>
                data.page.nextCursor &&
                setCursorStack((stack) => [
                  ...stack,
                  data.page.nextCursor ?? undefined,
                ])
              }
            >
              Próxima <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </nav>
        </>
      ) : null}
    </div>
  );
}
