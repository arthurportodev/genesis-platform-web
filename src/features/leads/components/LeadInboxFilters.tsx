import { Search, SlidersHorizontal } from "lucide-react";

import {
  leadNextActionStates,
  leadSorts,
  leadSources,
  leadStages,
  leadStatuses,
  type LeadListFilters,
  type Member,
} from "@/features/leads/api/lead-contracts";
import {
  stageLabels,
  statusLabels,
  temporalLabels,
} from "@/features/leads/api/lead-labels";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

export function LeadInboxFilters({
  search,
  searchMessage,
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
  searchMessage: string | null;
  filters: LeadListFilters;
  members: readonly Member[];
  canUseDirectory: boolean;
  hasMoreMembers: boolean;
  loadingMoreMembers: boolean;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: LeadListFilters) => void;
  onLoadMoreMembers: () => void;
}) {
  const set = <K extends keyof LeadListFilters>(
    key: K,
    value: LeadListFilters[K],
  ) => onFiltersChange({ ...filters, [key]: value });

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      aria-label="Filtros de Leads"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,2fr)_repeat(3,minmax(10rem,1fr))]">
        <div>
          <Label htmlFor="lead-search">Buscar</Label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="lead-search"
              value={search}
              maxLength={101}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nome, empresa, e-mail ou telefone"
              className="pl-9"
              aria-describedby={searchMessage ? "lead-search-help" : undefined}
            />
          </div>
          {searchMessage ? (
            <p
              id="lead-search-help"
              className="mt-1 text-xs text-warning-foreground"
            >
              {searchMessage}
            </p>
          ) : null}
        </div>
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) =>
            set("status", value as LeadListFilters["status"])
          }
        >
          {leadStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Etapa"
          value={filters.stage ?? ""}
          onChange={(value) =>
            set("stage", (value || undefined) as LeadListFilters["stage"])
          }
        >
          <option value="">Todas</option>
          {leadStages.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabels[stage]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Origem"
          value={filters.source ?? ""}
          onChange={(value) =>
            set("source", (value || undefined) as LeadListFilters["source"])
          }
        >
          <option value="">Todas</option>
          {leadSources.map((source) => (
            <option key={source} value={source}>
              {source.replaceAll("_", " ")}
            </option>
          ))}
        </FilterSelect>
      </div>

      <details className="mt-4 border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Mais filtros
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Próxima ação"
            value={filters.nextActionState ?? ""}
            onChange={(value) =>
              set(
                "nextActionState",
                (value || undefined) as LeadListFilters["nextActionState"],
              )
            }
          >
            <option value="">Todas</option>
            {leadNextActionStates.map((state) => (
              <option key={state} value={state}>
                {temporalLabels[state]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Ordenar"
            value={filters.sort}
            onChange={(value) => set("sort", value as LeadListFilters["sort"])}
          >
            {leadSorts.map((sort) => (
              <option key={sort} value={sort}>
                {sort === "createdAt:desc"
                  ? "Mais recentes"
                  : sort === "createdAt:asc"
                    ? "Mais antigos"
                    : sort.endsWith(":asc")
                      ? "Próxima ação primeiro"
                      : "Próxima ação por último"}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Por página"
            value={String(filters.limit)}
            onChange={(value) => set("limit", Number(value))}
          >
            {[10, 25, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </FilterSelect>
          {canUseDirectory ? (
            <div>
              <FilterSelect
                label="Responsável"
                value={filters.responsibleMembershipId ?? ""}
                onChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    responsibleMembershipId: value || undefined,
                    assignedToMe: undefined,
                    unassigned: undefined,
                  })
                }
              >
                <option value="">Todos</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </FilterSelect>
              {hasMoreMembers ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-primary"
                  disabled={loadingMoreMembers}
                  onClick={onLoadMoreMembers}
                >
                  {loadingMoreMembers
                    ? "Carregando…"
                    : "Carregar mais responsáveis"}
                </button>
              ) : null}
            </div>
          ) : null}
          <FilterSelect
            label="Revisão de retorno"
            value={
              filters.returnPending === undefined
                ? ""
                : String(filters.returnPending)
            }
            onChange={(value) =>
              set("returnPending", value === "" ? undefined : value === "true")
            }
          >
            <option value="">Todas</option>
            <option value="true">Pendente</option>
            <option value="false">Sem pendência</option>
          </FilterSelect>
          <DateFilter
            label="Criado desde"
            value={filters.createdFrom ?? ""}
            onChange={(value) => set("createdFrom", value || undefined)}
          />
          <DateFilter
            label="Criado até"
            value={filters.createdTo ?? ""}
            onChange={(value) => set("createdTo", value || undefined)}
          />
          <DateFilter
            label="Última entrada desde"
            value={filters.lastEntryFrom ?? ""}
            onChange={(value) => set("lastEntryFrom", value || undefined)}
          />
          <DateFilter
            label="Última entrada até"
            value={filters.lastEntryTo ?? ""}
            onChange={(value) => set("lastEntryTo", value || undefined)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <CheckFilter
            label="Atribuídos a mim"
            checked={filters.assignedToMe === true}
            onChange={(checked) =>
              onFiltersChange({
                ...filters,
                assignedToMe: checked || undefined,
                unassigned: checked ? undefined : filters.unassigned,
                responsibleMembershipId: checked
                  ? undefined
                  : filters.responsibleMembershipId,
              })
            }
          />
          <CheckFilter
            label="Sem responsável"
            checked={filters.unassigned === true}
            onChange={(checked) =>
              onFiltersChange({
                ...filters,
                unassigned: checked || undefined,
                assignedToMe: checked ? undefined : filters.assignedToMe,
                responsibleMembershipId: checked
                  ? undefined
                  : filters.responsibleMembershipId,
              })
            }
          />
        </div>
      </details>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = `filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        className="mt-1.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </Select>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `filter-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1.5"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function CheckFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-input"
      />
      {label}
    </label>
  );
}
