import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  useForm,
  useWatch,
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";

import type {
  CreateLeadInput,
  Member,
} from "@/features/leads/api/lead-contracts";
import {
  buildCreateLeadInput,
  defaultLeadCreateValues,
  formatLeadPhoneOnBlur,
  leadCreateFormSchema,
  type LeadCreateFormValues,
} from "@/features/leads/model/lead-create";
import { formatBrlInput } from "@/features/leads/model/lead-money";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

function FormField({
  id,
  label,
  error,
  required,
  help,
  prefix,
  registration,
  ...input
}: {
  id: string;
  label: string;
  error?: FieldError;
  required?: boolean;
  help?: string;
  prefix?: string;
  registration: UseFormRegisterReturn;
} & Omit<React.ComponentProps<typeof Input>, "id">) {
  const { onBlur, ...inputProps } = input;
  const { onBlur: registerBlur, ...registerProps } = registration;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </Label>
      <div
        className={prefix ? "flex rounded-md border border-input" : undefined}
      >
        {prefix ? (
          <span className="flex items-center border-r border-input px-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          className={`min-h-11 text-base sm:text-sm ${prefix ? "border-0 shadow-none focus-visible:ring-0" : ""}`}
          required={required}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [help ? helpId : null, error ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          {...inputProps}
          {...registerProps}
          onBlur={(event) => {
            void registerBlur(event);
            onBlur?.(event);
          }}
        />
      </div>
      {help ? (
        <p id={helpId} className="text-xs leading-5 text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function LeadCreateForm({
  canChooseResponsible,
  members,
  directoryPending,
  directoryError,
  hasMoreMembers,
  loadingMoreMembers,
  busy,
  uncertain,
  onLoadMoreMembers,
  onSubmit,
  onCancel,
  onPendingChanges,
}: {
  canChooseResponsible: boolean;
  members: readonly Member[];
  directoryPending: boolean;
  directoryError: boolean;
  hasMoreMembers: boolean;
  loadingMoreMembers: boolean;
  busy: boolean;
  uncertain: boolean;
  onLoadMoreMembers: () => void;
  onSubmit: (input: CreateLeadInput) => Promise<void>;
  onCancel: () => void;
  onPendingChanges: (pending: boolean) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<LeadCreateFormValues>({
    resolver: zodResolver(leadCreateFormSchema),
    defaultValues: defaultLeadCreateValues,
    shouldFocusError: true,
  });
  const source = useWatch({ control, name: "source" });
  useEffect(() => {
    if (source !== "other" && getValues("sourceDetail") !== "")
      setValue("sourceDetail", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
  }, [getValues, setValue, source]);
  useEffect(
    () => onPendingChanges(isDirty || uncertain),
    [isDirty, onPendingChanges, uncertain],
  );
  return (
    <form
      className="space-y-6"
      aria-busy={busy}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(async (values) => {
          await onSubmit(buildCreateLeadInput(values, canChooseResponsible));
        })(event);
      }}
    >
      {Object.keys(errors).length > 0 ? (
        <p
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          Revise os campos indicados antes de criar o Lead.
        </p>
      ) : null}

      <fieldset
        className="space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-6"
        disabled={busy || uncertain}
      >
        <legend className="px-2 text-base font-semibold">Identificação</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            id="lead-display-name"
            label="Nome"
            required
            autoComplete="name"
            maxLength={160}
            error={errors.displayName}
            registration={register("displayName")}
          />
          <FormField
            id="lead-primary-phone"
            label="Telefone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            help="Aceita formato nacional ou internacional. A validação final é do serviço."
            error={errors.primaryPhone}
            registration={register("primaryPhone")}
            onBlur={(event) =>
              setValue(
                "primaryPhone",
                formatLeadPhoneOnBlur(event.currentTarget.value),
                { shouldDirty: true, shouldValidate: true },
              )
            }
          />
          <FormField
            id="lead-email"
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={320}
            error={errors.email}
            registration={register("email")}
          />
          <FormField
            id="lead-company"
            label="Empresa"
            autoComplete="organization"
            maxLength={160}
            error={errors.companyName}
            registration={register("companyName")}
          />
          <FormField
            id="lead-instagram"
            label="Instagram"
            maxLength={64}
            error={errors.instagram}
            registration={register("instagram")}
          />
          <FormField
            id="lead-city"
            label="Cidade"
            autoComplete="address-level2"
            maxLength={120}
            error={errors.city}
            registration={register("city")}
          />
          <FormField
            id="lead-service-interest"
            label="Interesse"
            maxLength={160}
            error={errors.serviceInterest}
            registration={register("serviceInterest")}
          />
          <FormField
            id="lead-expected-value"
            label="Valor da oportunidade"
            prefix="R$"
            placeholder="0,00"
            inputMode="decimal"
            error={errors.expectedValue}
            registration={register("expectedValue")}
            onBlur={(event) => {
              try {
                setValue(
                  "expectedValue",
                  formatBrlInput(event.currentTarget.value),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  },
                );
              } catch {
                setValue("expectedValue", event.currentTarget.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
            }}
          />
        </div>
      </fieldset>

      <fieldset
        className="space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-6"
        disabled={busy || uncertain}
      >
        <legend className="px-2 text-base font-semibold">Origem</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lead-source">Origem</Label>
            <Select
              id="lead-source"
              className="min-h-11 text-base sm:text-sm"
              {...register("source")}
            >
              <option value="manual">Manual</option>
              <option value="landing_page">Landing page</option>
              <option value="campaign">Campanha</option>
              <option value="lead_magnet">Material rico</option>
              <option value="other">Outra origem</option>
            </Select>
          </div>
          {source === "other" ? (
            <FormField
              id="lead-source-detail"
              label="Detalhe da origem"
              required
              maxLength={120}
              error={errors.sourceDetail}
              registration={register("sourceDetail")}
            />
          ) : null}
        </div>
      </fieldset>

      {canChooseResponsible ? (
        <fieldset
          className="space-y-3 rounded-xl border border-border bg-surface p-4 sm:p-6"
          disabled={busy || uncertain}
        >
          <legend className="px-2 text-base font-semibold">Atribuição</legend>
          <Label htmlFor="lead-responsible">Responsável</Label>
          <Select
            id="lead-responsible"
            className="min-h-11 text-base sm:text-sm"
            aria-describedby="lead-responsible-help"
            disabled={busy || uncertain || directoryPending || directoryError}
            {...register("responsibleMembershipId")}
          >
            <option value="">Sem responsável</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.email}
              </option>
            ))}
          </Select>
          <p
            id="lead-responsible-help"
            className="text-xs leading-5 text-muted-foreground"
          >
            {directoryError
              ? "O diretório está indisponível. O Lead ainda pode ser criado sem responsável."
              : directoryPending
                ? "Carregando responsáveis ativos…"
                : "Somente Memberships ativas autorizadas pelo serviço são exibidas."}
          </p>
          {hasMoreMembers ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={loadingMoreMembers}
              onClick={onLoadMoreMembers}
            >
              {loadingMoreMembers
                ? "Carregando…"
                : "Carregar mais responsáveis"}
            </Button>
          ) : null}
        </fieldset>
      ) : null}

      <details className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          Rastreamento avançado
        </summary>
        <fieldset
          className="mt-4 grid gap-5 md:grid-cols-2"
          disabled={busy || uncertain}
        >
          <legend className="sr-only">Parâmetros UTM</legend>
          {(
            [
              ["utmSource", "UTM source"],
              ["utmMedium", "UTM medium"],
              ["utmCampaign", "UTM campaign"],
              ["utmContent", "UTM content"],
              ["utmTerm", "UTM term"],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              id={`lead-${name}`}
              label={label}
              maxLength={255}
              error={errors[name]}
              registration={register(name)}
            />
          ))}
        </fieldset>
      </details>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={busy || uncertain}>
          {busy ? "Criando…" : "Criar Lead"}
        </Button>
      </div>
    </form>
  );
}
