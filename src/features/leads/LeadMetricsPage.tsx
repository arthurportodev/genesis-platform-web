import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { LeadMetricsFeedback } from "@/features/leads/components/LeadMetricsFeedback";
import { LeadMetricsPeriod } from "@/features/leads/components/LeadMetricsPeriod";
import { LeadMetricsPeriodSelector } from "@/features/leads/components/LeadMetricsPeriodSelector";
import { LeadMetricsSnapshot } from "@/features/leads/components/LeadMetricsSnapshot";
import { LeadMetricsSourceBreakdown } from "@/features/leads/components/LeadMetricsSourceBreakdown";
import {
  useLeadMetrics,
  type MetricsAccessLoss,
} from "@/features/leads/hooks/use-lead-metrics";
import {
  formatMetricsAsOf,
  formatMetricsPeriod,
} from "@/features/leads/model/lead-metrics";
import {
  canonicalMetricsPeriodFromSearch,
  organizationCivilDate,
  type CanonicalMetricsPeriod,
} from "@/features/leads/model/lead-metrics-period";
import { toAppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";
import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader } from "@/shared/ui/Card";
import { Skeleton } from "@/shared/ui/Skeleton";

function MetricsLoading() {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Carregando métricas"
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Consultando a fonte oficial das métricas…
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-20" />
              <Skeleton className="mt-3 h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MetricsAccessUnavailable() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Métricas"
        description="Indicadores operacionais da Organization ativa."
      />
      <OperationalState
        kind="unavailable"
        title="Métricas indisponíveis para seu acesso"
        description="Somente owner ou admin pode consultar estes dados comerciais. O backend continua sendo a autoridade de acesso."
        action={{ label: "Voltar à visão geral", href: "/app" }}
      />
    </div>
  );
}

function MetricsSessionUnavailable() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Métricas"
        description="Indicadores operacionais da Organization ativa."
      />
      <OperationalState
        kind="unavailable"
        title="Sessão não confirmada"
        description="Não foi possível confirmar suas credenciais. Nenhum indicador foi mantido nesta tela."
        action={{ label: "Voltar ao login", href: "/login" }}
      />
    </div>
  );
}

function AuthorizedMetrics({
  period,
  periodNotice,
  onPeriodChange,
  onAccessLost,
}: {
  period: CanonicalMetricsPeriod;
  periodNotice: string | null;
  onPeriodChange: (period: CanonicalMetricsPeriod) => void;
  onAccessLost: (reason: MetricsAccessLoss) => void;
}) {
  const query = useLeadMetrics(period, onAccessLost);
  const [liveMessage, setLiveMessage] = useState("");
  const [expiredCooldownError, setExpiredCooldownError] =
    useState<unknown>(null);
  const errorKind = query.isError ? toAppError(query.error).kind : null;
  const cooldown =
    errorKind === "rate-limited" && expiredCooldownError !== query.error;

  useEffect(() => {
    if (errorKind !== "rate-limited") return;
    const timer = globalThis.setTimeout(
      () => setExpiredCooldownError(query.error),
      environment.rateLimitCooldownMs,
    );
    return () => globalThis.clearTimeout(timer);
  }, [errorKind, query.error]);

  const refresh = async () => {
    if (cooldown || query.isFetching) return;
    setLiveMessage("Atualizando métricas.");
    const result = await query.refetch();
    setLiveMessage(
      result.isSuccess
        ? "Métricas atualizadas."
        : "Não foi possível atualizar as métricas.",
    );
  };

  if (errorKind === "forbidden") {
    return <MetricsAccessUnavailable />;
  }

  const data = query.data;
  const organizationToday = data
    ? organizationCivilDate(data.asOf, data.timeZone)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análise"
        title="Métricas"
        description="Acompanhe indicadores calculados pela fonte oficial da operação comercial."
        action={
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={query.isFetching || cooldown}
            aria-busy={query.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw
              className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            {query.isFetching ? "Atualizando" : "Atualizar"}
          </Button>
        }
      />

      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {periodNotice ? (
        <p
          className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          {periodNotice} Exibindo o período padrão.
        </p>
      ) : null}

      <LeadMetricsPeriodSelector
        key={`${period.kind}:${period.kind === "range" ? `${period.from}:${period.to}` : "default"}:${data?.period.from ?? "pending"}:${data?.period.to ?? "pending"}`}
        period={period}
        organizationToday={organizationToday}
        responseRange={
          data ? { from: data.period.from, to: data.period.to } : undefined
        }
        disabled={query.isFetching && !data}
        onChange={onPeriodChange}
      />

      {query.isError ? (
        <LeadMetricsFeedback
          error={query.error}
          hasData={Boolean(data)}
          retryDisabled={query.isFetching || cooldown}
          onRetry={() => void refresh()}
        />
      ) : null}

      {query.isPending ? (
        <MetricsLoading />
      ) : !data ? null : (
        <>
          <section
            className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
            aria-label="Contexto das métricas"
          >
            <p>
              <span className="font-medium">Período:</span>{" "}
              {formatMetricsPeriod(data.period.from, data.period.to)}
            </p>
            <div className="text-muted-foreground sm:text-right">
              <p>Atualizado em {formatMetricsAsOf(data.asOf, data.timeZone)}</p>
              <p>Fuso da operação: {data.timeZone}</p>
            </div>
          </section>
          <LeadMetricsSnapshot snapshot={data.snapshot} />
          <LeadMetricsPeriod period={data.period} />
          <LeadMetricsSourceBreakdown summary={data} />
        </>
      )}
    </div>
  );
}

export function LeadMetricsPage() {
  const organization = useActiveOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/app/metrics" });
  const search = useSearch({ from: "/app/metrics" });
  const [periodNotice, setPeriodNotice] = useState<string | null>(
    search.invalidPeriodReason ?? null,
  );
  const [accessLoss, setAccessLoss] = useState<MetricsAccessLoss | null>(null);
  const canAccess =
    organization.role === "owner" || organization.role === "admin";
  const period = canonicalMetricsPeriodFromSearch(search);

  useEffect(() => {
    const invalidPeriodReason = search.invalidPeriodReason;
    if (!invalidPeriodReason) return;
    const noticeTimer = globalThis.setTimeout(
      () => setPeriodNotice(invalidPeriodReason),
      0,
    );
    void navigate({
      to: "/app/metrics",
      search: { from: undefined, to: undefined },
      replace: true,
    });
    return () => globalThis.clearTimeout(noticeTimer);
  }, [navigate, search.invalidPeriodReason]);

  useEffect(() => {
    if (canAccess && !accessLoss) return;
    const metricsRoot = leadQueryKeys.metricsRoot(organization.id);
    void queryClient
      .cancelQueries({ queryKey: metricsRoot })
      .then(() => queryClient.removeQueries({ queryKey: metricsRoot }));
  }, [accessLoss, canAccess, organization.id, queryClient]);

  const loseAccess = useCallback(
    (reason: MetricsAccessLoss) => setAccessLoss(reason),
    [],
  );
  const changePeriod = (next: CanonicalMetricsPeriod) => {
    setPeriodNotice(null);
    void navigate({
      to: "/app/metrics",
      search:
        next.kind === "default"
          ? { from: undefined, to: undefined }
          : { from: next.from, to: next.to },
    });
  };

  if (!canAccess || accessLoss === "forbidden")
    return <MetricsAccessUnavailable />;
  if (accessLoss === "session") return <MetricsSessionUnavailable />;
  return (
    <AuthorizedMetrics
      period={period}
      periodNotice={periodNotice}
      onPeriodChange={changePeriod}
      onAccessLost={loseAccess}
    />
  );
}
