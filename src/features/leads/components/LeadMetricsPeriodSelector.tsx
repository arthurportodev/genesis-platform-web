import { useRef, useState, type FormEvent } from "react";

import {
  canonicalMetricsRange,
  identifyMetricsPreset,
  metricsPeriodForPreset,
  type CanonicalMetricsPeriod,
  type CivilDate,
  type MetricsPreset,
} from "@/features/leads/model/lead-metrics-period";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

interface LeadMetricsPeriodSelectorProps {
  period: CanonicalMetricsPeriod;
  organizationToday?: CivilDate;
  responseRange?: { from: CivilDate; to: CivilDate };
  disabled?: boolean;
  onChange: (period: CanonicalMetricsPeriod) => void;
}

export function LeadMetricsPeriodSelector({
  period,
  organizationToday,
  responseRange,
  disabled = false,
  onChange,
}: LeadMetricsPeriodSelectorProps) {
  const inferredPreset = identifyMetricsPreset(period, organizationToday);
  const [showCustom, setShowCustom] = useState(inferredPreset === "custom");
  const [from, setFrom] = useState(
    period.kind === "range" ? period.from : (responseRange?.from ?? ""),
  );
  const [to, setTo] = useState(
    period.kind === "range" ? period.to : (responseRange?.to ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const selectPreset = (value: MetricsPreset) => {
    setError(null);
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    if (value === "last30") {
      onChange({ kind: "default" });
      return;
    }
    if (organizationToday)
      onChange(metricsPeriodForPreset(value, organizationToday));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const next = canonicalMetricsRange(from, to);
      setError(null);
      onChange(next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "O período é inválido.",
      );
      globalThis.setTimeout(() => errorRef.current?.focus(), 0);
    }
  };

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 sm:p-5"
      aria-labelledby="metrics-period-controls"
    >
      <h2 id="metrics-period-controls" className="text-sm font-semibold">
        Período das métricas
      </h2>
      <div className="mt-3 max-w-sm">
        <Label htmlFor="metrics-preset">Seleção de período</Label>
        <Select
          id="metrics-preset"
          className="mt-1 min-h-11"
          value={showCustom ? "custom" : inferredPreset}
          disabled={disabled}
          onChange={(event) =>
            selectPreset(event.target.value as MetricsPreset)
          }
        >
          <option value="last7" disabled={!organizationToday}>
            Últimos 7 dias
          </option>
          <option value="last30">Últimos 30 dias</option>
          <option value="last90" disabled={!organizationToday}>
            Últimos 90 dias
          </option>
          <option value="currentMonth" disabled={!organizationToday}>
            Mês atual
          </option>
          <option value="custom">Personalizado</option>
        </Select>
      </div>

      {showCustom ? (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={submit}
          noValidate
        >
          <div>
            <Label htmlFor="metrics-from">De</Label>
            <Input
              id="metrics-from"
              type="date"
              className="mt-1 min-h-11"
              value={from}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "metrics-period-error" : undefined}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="metrics-to">Até</Label>
            <Input
              id="metrics-to"
              type="date"
              className="mt-1 min-h-11"
              value={to}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "metrics-period-error" : undefined}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <Button type="submit" className="min-h-11" disabled={disabled}>
            Aplicar período
          </Button>
          {error ? (
            <p
              ref={errorRef}
              id="metrics-period-error"
              className="text-sm text-destructive sm:col-span-3"
              role="alert"
              tabIndex={-1}
            >
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
