import { useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { Brand } from "@/shared/components/Brand";
import { OperationalState } from "@/shared/components/OperationalState";
import { useSession } from "@/features/auth/session/useSession";
import { isAuthenticatedState } from "@/features/auth/session/session-machine";
import { Button } from "@/shared/ui/Button";
import { SessionGate } from "@/features/auth/SessionGate";
import { toAppError } from "@/shared/api/errors";

export function SelectOrganizationPage() {
  const { session, state } = useSession();
  const navigate = useNavigate();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!isAuthenticatedState(state)) {
    return <SessionGate />;
  }

  const select = async (organizationId: string) => {
    setActionMessage(null);
    await session.selectOrganization(organizationId);
    await navigate({ to: "/app", replace: true });
  };

  const leave = async (allDevices: boolean) => {
    setActionMessage(null);
    if (allDevices) await session.logoutAll();
    else await session.logout();
    await navigate({
      to: "/login",
      search: { returnTo: undefined },
      replace: true,
    });
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                void leave(false).catch((error: unknown) =>
                  setActionMessage(toAppError(error).message),
                );
              }}
            >
              Sair
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void leave(true).catch((error: unknown) =>
                  setActionMessage(toAppError(error).message),
                );
              }}
            >
              Sair de todos os dispositivos
            </Button>
          </div>
        </div>
        <div className="mt-16 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Selecione uma organização
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Escolha o contexto em que deseja trabalhar. A API continuará
            validando sua membership em cada operação.
          </p>
        </div>
        <div className="mt-8">
          {state.organizations.length === 0 ? (
            <OperationalState
              kind="unavailable"
              title="Nenhuma organização disponível"
              description="Sua conta está ativa, mas ainda não possui acesso a uma organização."
            />
          ) : (
            <div
              className="mx-auto grid max-w-2xl gap-3"
              aria-label="Organizações disponíveis"
            >
              {state.organizations.map((organization) => (
                <Button
                  key={organization.id}
                  variant="secondary"
                  className="h-auto justify-start p-4 text-left"
                  disabled={state.status === "switching-organization"}
                  onClick={() => {
                    void select(organization.id).catch((error: unknown) =>
                      setActionMessage(toAppError(error).message),
                    );
                  }}
                >
                  <Building2 className="size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">
                      {organization.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Papel: {organization.role}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          )}
          {actionMessage ? (
            <p
              className="mx-auto mt-4 max-w-2xl text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              {actionMessage}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
