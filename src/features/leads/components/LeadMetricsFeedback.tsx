import { RefreshCw } from "lucide-react";

import { toAppError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/Button";

function metricsErrorCopy(error: unknown): {
  title: string;
  description: string;
} {
  const appError = toAppError(error);
  if (appError.kind === "validation")
    return {
      title: "Período não aceito",
      description: "Revise o período ou volte aos últimos 30 dias.",
    };
  if (appError.kind === "forbidden")
    return {
      title: "Métricas indisponíveis para seu acesso",
      description:
        "Seu papel atual não permite consultar os indicadores desta Organization.",
    };
  if (appError.kind === "rate-limited")
    return {
      title: "Atualizações temporariamente limitadas",
      description:
        "Aguarde o cooldown antes de consultar as métricas novamente.",
    };
  if (appError.kind === "not-found")
    return {
      title: "Integração de métricas não encontrada",
      description:
        "A rota esperada da API não está disponível. Nenhum valor foi estimado.",
    };
  if (appError.kind === "protocol")
    return {
      title: "Resposta de métricas inválida",
      description:
        "A API retornou um contrato incompatível. Nenhum dado parcial foi exibido.",
    };
  if (appError.kind === "server" && appError.status === 503)
    return {
      title: "Leitura operacional indisponível",
      description:
        "A API ainda não está pronta para uma leitura confiável. Isso não significa ausência de dados.",
    };
  return {
    title: "Não foi possível carregar as métricas",
    description: appError.message,
  };
}

export function LeadMetricsFeedback({
  error,
  hasData,
  retryDisabled,
  onRetry,
}: {
  error: unknown;
  hasData: boolean;
  retryDisabled: boolean;
  onRetry: () => void;
}) {
  const appError = toAppError(error);
  const copy = metricsErrorCopy(error);
  const retryAllowed =
    appError.kind !== "forbidden" &&
    appError.kind !== "unauthorized" &&
    appError.kind !== "session-expired";
  return (
    <section
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-5"
      role="alert"
    >
      <h2 className="font-semibold">{copy.title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {copy.description}
        {hasData ? " Os dados anteriores permanecem visíveis." : ""}
      </p>
      {retryAllowed ? (
        <Button
          className="mt-4 min-h-11"
          variant="secondary"
          disabled={retryDisabled}
          onClick={onRetry}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      ) : null}
    </section>
  );
}
