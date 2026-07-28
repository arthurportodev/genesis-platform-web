import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

import { useSession } from "@/features/auth/session/useSession";
import { Brand } from "@/shared/components/Brand";
import { Button } from "@/shared/ui/Button";

export function SessionGate() {
  const { session, state } = useSession();
  const retryable = state.status === "fatal-error" && state.retryable;
  const fatal = state.status === "fatal-error";
  const message =
    "message" in state && state.message
      ? state.message
      : "Verificando sua sessão…";

  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-10"
      aria-busy={
        state.status === "initializing" || state.status === "refreshing"
      }
    >
      <div
        className="max-w-md text-center"
        role={fatal ? "alert" : "status"}
        aria-live={fatal ? "assertive" : "polite"}
      >
        <Brand className="mb-8 justify-center" />
        {fatal ? (
          <AlertTriangle
            className="mx-auto size-7 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <LoaderCircle
            className="mx-auto size-7 animate-spin text-primary"
            aria-hidden="true"
          />
        )}
        <h1 className="mt-4 text-lg font-semibold">
          {fatal ? "Não foi possível continuar" : "Protegendo sua sessão"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        {fatal ? (
          <Button
            className="mt-5"
            onClick={() => {
              if (retryable) void session.retry().catch(() => undefined);
              else window.location.reload();
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {retryable ? "Tentar novamente" : "Recarregar página"}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
