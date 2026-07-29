import { SlidersHorizontal } from "lucide-react";

import {
  leadNextActionStates,
  leadSources,
  leadStatuses,
  type LeadMyActionsFilters,
  type LeadReturnReviewFilters,
  type LeadUnassignedFilters,
  type Member,
} from "@/features/leads/api/lead-contracts";
import { statusLabels, temporalLabels } from "@/features/leads/api/lead-labels";
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

interface CommonProps {
  members: readonly Member[];
  canUseDirectory: boolean;
}

type Props = CommonProps &
  (
    | {
        variant: "my-actions";
        filters: LeadMyActionsFilters;
        onChange: (filters: LeadMyActionsFilters) => void;
      }
    | {
        variant: "unassigned";
        filters: LeadUnassignedFilters;
        search: string;
        searchMessage: string | null;
        onSearchChange: (value: string) => void;
        onChange: (filters: LeadUnassignedFilters) => void;
      }
    | {
        variant: "return-reviews";
        filters: LeadReturnReviewFilters;
        search: string;
        searchMessage: string | null;
        onSearchChange: (value: string) => void;
        onChange: (filters: LeadReturnReviewFilters) => void;
      }
  );

function FilterFields({ props, prefix }: { props: Props; prefix: string }) {
  if (props.variant === "my-actions") {
    if (!props.canUseDirectory) return null;
    return (
      <div>
        <Label htmlFor={`${prefix}-work-responsible`}>Ações de</Label>
        <Select
          id={`${prefix}-work-responsible`}
          className="mt-1.5 min-h-11"
          value={props.filters.responsibleMembershipId ?? ""}
          onChange={(event) =>
            props.onChange({
              ...props.filters,
              responsibleMembershipId: event.target.value || undefined,
            })
          }
        >
          <option value="">Minhas ações</option>
          {props.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  const searchId = `${prefix}-${props.variant}-search`;
  return (
    <>
      <div>
        <Label htmlFor={searchId}>Buscar</Label>
        <Input
          id={searchId}
          className="mt-1.5 min-h-11"
          value={props.search}
          onChange={(event) => props.onSearchChange(event.target.value)}
          aria-describedby={
            props.searchMessage ? `${searchId}-message` : undefined
          }
          placeholder="Nome ou empresa"
        />
        {props.searchMessage ? (
          <p
            id={`${searchId}-message`}
            className="mt-1 text-xs text-destructive"
          >
            {props.searchMessage}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor={`${prefix}-${props.variant}-source`}>Origem</Label>
        <Select
          id={`${prefix}-${props.variant}-source`}
          className="mt-1.5 min-h-11"
          value={props.filters.source ?? ""}
          onChange={(event) => {
            const source = event.target.value
              ? (event.target.value as (typeof leadSources)[number])
              : undefined;
            if (props.variant === "unassigned")
              props.onChange({ ...props.filters, source });
            else props.onChange({ ...props.filters, source });
          }}
        >
          <option value="">Todas</option>
          {leadSources.map((source) => (
            <option key={source} value={source}>
              {source.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      {props.variant === "unassigned" ? (
        <>
          <div>
            <Label htmlFor={`${prefix}-unassigned-status`}>Status</Label>
            <Select
              id={`${prefix}-unassigned-status`}
              className="mt-1.5 min-h-11"
              value={props.filters.status}
              onChange={(event) =>
                props.onChange({
                  ...props.filters,
                  status: event.target.value as (typeof leadStatuses)[number],
                })
              }
            >
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${prefix}-unassigned-next-action`}>
              Próxima ação
            </Label>
            <Select
              id={`${prefix}-unassigned-next-action`}
              className="mt-1.5 min-h-11"
              value={props.filters.nextActionState ?? ""}
              onChange={(event) =>
                props.onChange({
                  ...props.filters,
                  nextActionState: event.target.value
                    ? (event.target
                        .value as (typeof leadNextActionStates)[number])
                    : undefined,
                })
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
          <DateRange
            prefix={`${prefix}-created`}
            label="Criação"
            from={props.filters.createdFrom}
            to={props.filters.createdTo}
            onChange={(createdFrom, createdTo) =>
              props.onChange({ ...props.filters, createdFrom, createdTo })
            }
          />
          <DateRange
            prefix={`${prefix}-last-entry`}
            label="Última entrada"
            from={props.filters.lastEntryFrom}
            to={props.filters.lastEntryTo}
            onChange={(lastEntryFrom, lastEntryTo) =>
              props.onChange({ ...props.filters, lastEntryFrom, lastEntryTo })
            }
          />
        </>
      ) : null}
    </>
  );
}

function DateRange({
  prefix,
  label,
  from,
  to,
  onChange,
}: {
  prefix: string;
  label: string;
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="col-span-2 text-sm font-medium">{label}</legend>
      <div>
        <Label htmlFor={`${prefix}-from`} className="text-xs">
          De
        </Label>
        <Input
          id={`${prefix}-from`}
          type="date"
          className="mt-1 min-h-11"
          value={from ?? ""}
          onChange={(event) => onChange(event.target.value || undefined, to)}
        />
      </div>
      <div>
        <Label htmlFor={`${prefix}-to`} className="text-xs">
          Até
        </Label>
        <Input
          id={`${prefix}-to`}
          type="date"
          className="mt-1 min-h-11"
          value={to ?? ""}
          onChange={(event) => onChange(from, event.target.value || undefined)}
        />
      </div>
    </fieldset>
  );
}

export function LeadFollowUpFilters(props: Props) {
  const hasFields = props.variant !== "my-actions" || props.canUseDirectory;
  if (!hasFields) return null;
  return (
    <>
      <div className="hidden rounded-xl border border-border bg-surface p-4 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <FilterFields props={props} prefix="desktop" />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="secondary" className="min-h-11">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetTitle>Filtros da fila</SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              Os filtros permanecem apenas nesta sessão.
            </SheetDescription>
            <div className="mt-6 grid gap-4">
              <FilterFields props={props} prefix="mobile" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
