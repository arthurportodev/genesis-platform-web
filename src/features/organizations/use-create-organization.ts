import { useEffect, useMemo, useRef, useState } from "react";

import { isAuthenticatedState } from "@/features/auth/session/session-machine";
import { useSession } from "@/features/auth/session/useSession";
import { createOrganizationApi } from "@/features/organizations/api/organization-api";
import { OrganizationCreationIntentRegistry } from "@/features/organizations/api/organization-creation-intent";
import type { CreateOrganizationInput } from "@/features/organizations/api/organization-contracts";
import { useHttpClient } from "@/shared/api/http-context";
import { AppError } from "@/shared/api/errors";

export function useCreateOrganization() {
  const http = useHttpClient();
  const { session } = useSession();
  const api = useMemo(() => createOrganizationApi(http), [http]);
  const intents = useRef(new OrganizationCreationIntentRegistry());
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const registry = intents.current;
    return () => registry.forget();
  }, []);

  const submit = async (input: CreateOrganizationInput): Promise<boolean> => {
    if (inFlight.current) return false;
    const intent = intents.current.begin(input);
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await api.create(intent.input, intent.key);
      await session.rebootstrap();
      const nextState = session.getSnapshot();
      if (!isAuthenticatedState(nextState))
        throw new AppError("session-expired", "Sua sessão expirou.");
      const created = nextState.organizations.find(
        ({ id }) => id === result.organization.id,
      );
      if (!created)
        throw new AppError(
          "protocol",
          "A organização criada ainda não está disponível. Tente novamente.",
        );
      if (nextState.activeOrganization?.id !== created.id)
        await session.selectOrganization(created.id);
      intents.current.forget();
      return true;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    submit,
    nameChanged: (name: string) => intents.current.forgetIfNameChanged(name),
  };
}
