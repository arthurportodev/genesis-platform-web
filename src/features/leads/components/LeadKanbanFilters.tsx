import { Filter, Search, X } from "lucide-react";
import { useState } from "react";

import {
  leadNextActionStates,
  leadSources,
  type LeadKanbanFilters,
  type Member,
} from "@/features/leads/api/lead-contracts";
import {
  defaultLeadKanbanFilters,
  leadSearchMessage,
} from "@/features/leads/api/lead-filters";
import { temporalLabels } from "@/features/leads/api/lead-labels";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/Sheet";

function assignmentValue(filters: LeadKanbanFilters): string {
  if (filters.assignedToMe) return "mine";
  if (filters.unassigned) return "unassigned";
  return filters.responsibleMembershipId ?? "";
}

function FilterFields({
  idPrefix,
  search,
  filters,
  members,
  canUseDirectory,
  hasMoreMembers,
  loadingMoreMembers,
  onSearchChange,
  onFiltersChange,
  onLoadMoreMembers,
}: {
  idPrefix: string;
  search: string;
  filters: LeadKanbanFilters;
  members: readonly Member[];
  canUseDirectory: boolean;
  hasMoreMembers: boolean;
  loadingMoreMembers: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: LeadKanbanFilters) => void;
  onLoadMoreMembers: () => void;
}) {
  const searchMessage = leadSearchMessage(search);
  const set = <K extends keyof LeadKanbanFilters>(
    key: K,
    value: LeadKanbanFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,2fr)_repeat(3,minmax(11rem,1fr))]">
      <div>
        <Label htmlFor={`${idPrefix}-search`}>Buscar</Label>
        <div className="relative mt-1.5">
          <Search
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${idPrefix}-search`}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nome, empresa, e-mail ou telefone"
            className="min-h-11 pl-9"
            aria-invalid={searchMessage ? true : undefined}
            aria-describedby={
              searchMessage ? `${idPrefix}-search-help` : undefined
            }
          />
        </div>
        {searchMessage ? (
          <p
            id={`${idPrefix}-search-help`}
            className="mt-1 text-xs text-warning-foreground"
          >
            {searchMessage}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-assignment`}>Responsável</Label>
        <Select
          id={`${idPrefix}-assignment`}
          className="mt-1.5 min-h-11"
          value={assignmentValue(filters)}
          onChange={(event) => {
            const value = event.target.value;
            onFiltersChange({
              ...filters,
              responsibleMembershipId:
                value && value !== "mine" && value !== "unassigned"
                  ? value
                  : undefined,
              assignedToMe: value === "mine" || undefined,
              unassigned: value === "unassigned" || undefined,
            });
          }}
        >
          <option value="">Todos os Leads visíveis</option>
          <option value="mine">Atribuídos a mim</option>
          {canUseDirectory ? (
            <option value="unassigned">Sem responsável</option>
          ) : null}
          {canUseDirectory
            ? members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))
            : null}
        </Select>
        {canUseDirectory && hasMoreMembers ? (
          <button
            type="button"
            className="mt-2 min-h-11 text-xs font-semibold text-primary"
            disabled={loadingMoreMembers}
            onClick={onLoadMoreMembers}
          >
            {loadingMoreMembers ? "Carregando…" : "Carregar mais responsáveis"}
          </button>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-source`}>Origem</Label>
        <Select
          id={`${idPrefix}-source`}
          className="mt-1.5 min-h-11"
          value={filters.source ?? ""}
          onChange={(event) =>
            set(
              "source",
              (event.target.value || undefined) as LeadKanbanFilters["source"],
            )
          }
        >
          <option value="">Todas</option>
          {leadSources.map((source) => (
            <option key={source} value={source}>
              {source.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-next-action`}>Próxima ação</Label>
        <Select
          id={`${idPrefix}-next-action`}
          className="mt-1.5 min-h-11"
          value={filters.nextActionState ?? ""}
          onChange={(event) =>
            set(
              "nextActionState",
              (event.target.value ||
                undefined) as LeadKanbanFilters["nextActionState"],
            )
          }
        >
          <option value="">Todas</option>
          {leadNextActionStates.map((state) => (
            <option key={state} value={state}>
              {temporalLabels[state]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function LeadKanbanFilters({
  search,
  filters,
  members,
  canUseDirectory,
  hasMoreMembers,
  loadingMoreMembers,
  onSearchChange,
  onFiltersChange,
  onLoadMoreMembers,
}: {
  search: string;
  filters: LeadKanbanFilters;
  members: readonly Member[];
  canUseDirectory: boolean;
  hasMoreMembers: boolean;
  loadingMoreMembers: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: LeadKanbanFilters) => void;
  onLoadMoreMembers: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const common = {
    search,
    filters,
    members,
    canUseDirectory,
    hasMoreMembers,
    loadingMoreMembers,
    onSearchChange,
    onFiltersChange,
    onLoadMoreMembers,
  };
  const clear = () => {
    onSearchChange("");
    onFiltersChange(defaultLeadKanbanFilters);
  };
  return (
    <>
      <section
        className="hidden rounded-xl border border-border bg-surface p-4 shadow-sm md:block"
        aria-label="Filtros do Pipeline"
      >
        <FilterFields idPrefix="pipeline-desktop" {...common} />
        <Button className="mt-4 min-h-11" variant="ghost" onClick={clear}>
          <X className="size-4" aria-hidden="true" /> Limpar filtros
        </Button>
      </section>
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" className="min-h-11">
              <Filter className="size-4" aria-hidden="true" /> Filtros
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetTitle>Filtros do Pipeline</SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              Os filtros permanecem somente em memória nesta Organization.
            </SheetDescription>
            <div className="mt-6">
              <FilterFields idPrefix="pipeline-mobile" {...common} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button className="min-h-11" variant="ghost" onClick={clear}>
                <X className="size-4" aria-hidden="true" /> Limpar
              </Button>
              <Button className="min-h-11" onClick={() => setMobileOpen(false)}>
                Ver Pipeline
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
