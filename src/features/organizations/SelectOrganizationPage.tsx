import { useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useState } from "react";

import { Brand } from "@/shared/components/Brand";
import { useSession } from "@/features/auth/session/useSession";
import { isAuthenticatedState } from "@/features/auth/session/session-machine";
import { createOrganizationInputSchema } from "@/features/organizations/api/organization-contracts";
import { useCreateOrganization } from "@/features/organizations/use-create-organization";
import { Button } from "@/shared/ui/Button";
import { SessionGate } from "@/features/auth/SessionGate";
import { toAppError } from "@/shared/api/errors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";

export function SelectOrganizationPage() {
  const { session, state } = useSession();
  const navigate = useNavigate();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const creation = useCreateOrganization();

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

  const createFirstOrganization = async () => {
    setActionMessage(null);
    setNameMessage(null);
    const parsed = createOrganizationInputSchema.safeParse({ name });
    if (!parsed.success) {
      setNameMessage(parsed.error.issues[0]?.message ?? "Revise o nome.");
      return;
    }
    try {
      if (await creation.submit(parsed.data))
        await navigate({ to: "/app", replace: true });
    } catch (error) {
      setActionMessage(toAppError(error).message);
    }
  };

  const hasOrganizations = state.organizations.length > 0;

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
            {hasOrganizations
              ? "Selecione uma organização"
              : "Crie sua primeira organização"}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {hasOrganizations
              ? "Escolha o contexto em que deseja trabalhar. A API continuará validando sua membership em cada operação."
              : "Sua organização é o espaço onde seus leads, pipeline e equipe serão organizados."}
          </p>
        </div>
        <div className="mt-8">
          {!hasOrganizations ? (
            <Card className="mx-auto max-w-md">
              <CardHeader>
                <CardTitle>Comece pelo nome da sua organização</CardTitle>
                <CardDescription>
                  Você poderá convidar sua equipe depois de entrar no CRM.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createFirstOrganization();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="organization-name">
                      Nome da organização
                    </Label>
                    <Input
                      id="organization-name"
                      name="organizationName"
                      autoComplete="organization"
                      value={name}
                      disabled={creation.busy}
                      aria-invalid={Boolean(nameMessage)}
                      aria-describedby={
                        nameMessage ? "organization-name-error" : undefined
                      }
                      onChange={(event) => {
                        const nextName = event.target.value;
                        creation.nameChanged(nextName);
                        setName(nextName);
                        setNameMessage(null);
                        setActionMessage(null);
                      }}
                    />
                    {nameMessage ? (
                      <p
                        id="organization-name-error"
                        className="text-sm text-destructive"
                        role="alert"
                        aria-live="assertive"
                      >
                        {nameMessage}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={creation.busy}
                  >
                    {creation.busy
                      ? "Criando organização…"
                      : "Criar organização"}
                  </Button>
                </form>
              </CardContent>
            </Card>
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
