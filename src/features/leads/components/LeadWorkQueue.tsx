import type { ReactNode } from "react";

import { toAppError } from "@/shared/api/errors";
import { OperationalState } from "@/shared/components/OperationalState";
import { Button } from "@/shared/ui/Button";

function queueErrorMessage(error: unknown): string {
  const appError = toAppError(error);
  if (appError.kind === "forbidden")
    return "Seu papel não permite consultar esta fila.";
  if (appError.kind === "rate-limited")
    return "Muitas consultas foram realizadas. Aguarde o cooldown antes de tentar novamente.";
  if (appError.kind === "server")
    return "A leitura operacional está temporariamente indisponível.";
  return appError.message;
}

export function LeadWorkQueue<T>({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  total,
  asOf,
  pending,
  error,
  fetching,
  fetchingMore,
  continuationError,
  hasMore,
  onRefresh,
  onLoadMore,
  getKey,
  renderItem,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: readonly T[];
  total: number;
  asOf: string | null;
  pending: boolean;
  error: unknown;
  fetching: boolean;
  fetchingMore: boolean;
  continuationError: unknown;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  return (
    <section aria-labelledby="lead-work-queue-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="lead-work-queue-heading"
            data-lead-work-heading
            tabIndex={-1}
            className="text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={fetching}
          onClick={onRefresh}
        >
          {fetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {pending ? (
        <OperationalState
          kind="loading"
          compact
          title="Carregando fila"
          description="Consultando a Organization ativa."
        />
      ) : error && items.length === 0 ? (
        <section
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
          role="alert"
        >
          <h3 className="font-semibold">Não foi possível carregar a fila</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {queueErrorMessage(error)}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 min-h-11"
            onClick={onRefresh}
          >
            Tentar novamente
          </Button>
        </section>
      ) : items.length === 0 ? (
        <OperationalState
          kind="empty"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">{items.length}</strong>{" "}
              carregados de <strong className="text-foreground">{total}</strong>
            </p>
            {asOf ? (
              <p>
                Atualizado em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(asOf))}
              </p>
            ) : null}
          </div>
          {error ? (
            <p
              className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm"
              role="alert"
            >
              {queueErrorMessage(error)} Os itens carregados foram preservados.
            </p>
          ) : null}
          <ul className="grid gap-3 xl:grid-cols-2" aria-label={title}>
            {items.map((item, index) => (
              <li key={getKey(item)}>{renderItem(item, index)}</li>
            ))}
          </ul>
          {continuationError ? (
            <p
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
              role="alert"
            >
              Não foi possível carregar mais itens. Os itens anteriores foram
              preservados.
            </p>
          ) : null}
          {hasMore ? (
            <div className="text-center">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={fetchingMore}
                onClick={onLoadMore}
              >
                {fetchingMore ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
