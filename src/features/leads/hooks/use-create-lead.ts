import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type {
  CreateLeadInput,
  CreateLeadResult,
} from "@/features/leads/api/lead-contracts";
import {
  hasUncertainLeadCreationOutcome,
  LeadCreateIntentRegistry,
  type LeadCreateIntent,
} from "@/features/leads/api/lead-intent-keys";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import { AppError, toAppError } from "@/shared/api/errors";
import type { ActiveOrganization } from "@/shared/organization/active-organization";

export type LeadCreateFeedback =
  | { kind: "error"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "abandoned"; message: string };

function leadCreationErrorMessage(error: AppError): string {
  switch (error.kind) {
    case "validation":
      return "Revise os dados informados. O telefone será validado pelo serviço.";
    case "forbidden":
      return "Seu acesso à criação mudou. A Organization será reavaliada.";
    case "not-found":
      return "O responsável selecionado não está mais disponível. Atualize o diretório e tente novamente.";
    case "conflict":
      return "A intenção de criação entrou em conflito. Revise o formulário e envie uma nova intenção.";
    case "rate-limited":
      return "Muitas tentativas foram realizadas. Aguarde e envie novamente.";
    default:
      return error.message;
  }
}

export async function invalidateLeadCreation(
  queryClient: QueryClient,
  organizationId: string,
  input: CreateLeadInput,
  result: CreateLeadResult,
): Promise<void> {
  const keys: Array<readonly unknown[]> = [
    leadQueryKeys.inboxes(organizationId),
    leadQueryKeys.kanbans(organizationId),
  ];
  if (result.kind === "opaque") {
    keys.push(leadQueryKeys.myActionsRoot(organizationId));
  } else {
    keys.push(
      leadQueryKeys.detail(organizationId, result.lead.id),
      leadQueryKeys.timeline(organizationId, result.lead.id),
    );
    if (result.status === 201 || result.replayed)
      keys.push(leadQueryKeys.metricsRoot(organizationId));
    if (
      result.status === 201 &&
      (input.responsibleMembershipId ?? null) === null
    )
      keys.push(leadQueryKeys.unassignedQueues(organizationId));
    if (result.lead.returnReviewPending) {
      keys.push(
        leadQueryKeys.returnReviewQueues(organizationId),
        leadQueryKeys.metricsRoot(organizationId),
      );
    }
    if (result.lead.nextAction?.status === "pending")
      keys.push(leadQueryKeys.myActionsRoot(organizationId));
  }
  const unique = new Map(keys.map((key) => [JSON.stringify(key), key]));
  await Promise.all(
    [...unique.values()].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useCreateLead(organization: ActiveOrganization) {
  const queryClient = useQueryClient();
  const api = useLeadApi();
  const intents = useRef(new LeadCreateIntentRegistry());
  const disposed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState<LeadCreateFeedback | null>(null);

  useEffect(() => {
    const registry = intents.current;
    disposed.current = false;
    return () => {
      disposed.current = true;
      registry.forget();
    };
  }, []);

  const mutation = useMutation({
    mutationKey: leadQueryKeys.create(organization.id),
    mutationFn: () => {
      const intent = intents.current.current();
      if (!intent)
        throw new AppError("unknown", "A intenção de criação não está ativa.");
      return api.create(intent.payload, intent.key);
    },
    gcTime: 0,
    retry: 0,
  });

  const execute = async (
    intent: LeadCreateIntent,
  ): Promise<CreateLeadResult | null> => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await mutation.mutateAsync();
      const current = intents.current.current();
      if (
        disposed.current ||
        current?.key !== intent.key ||
        current.organizationId !== organization.id ||
        current.actorMembershipId !== organization.membershipId
      ) {
        mutation.reset();
        return null;
      }
      await invalidateLeadCreation(
        queryClient,
        organization.id,
        intent.payload,
        result,
      );
      intents.current.forget();
      setUncertain(false);
      mutation.reset();
      return result;
    } catch (error) {
      const appError = toAppError(error);
      const current = intents.current.current();
      if (
        disposed.current ||
        current?.key !== intent.key ||
        current.organizationId !== organization.id ||
        current.actorMembershipId !== organization.membershipId
      ) {
        mutation.reset();
        return null;
      }
      if (hasUncertainLeadCreationOutcome(appError.kind)) {
        setUncertain(true);
        setFeedback({
          kind: "uncertain",
          message:
            "Resultado não confirmado. Tente confirmar com a mesma intenção ou abandone a tentativa.",
        });
      } else {
        intents.current.forget();
        if (appError.kind === "not-found")
          await queryClient.invalidateQueries({
            queryKey: leadQueryKeys.assignees(organization.id),
          });
        setUncertain(false);
        setFeedback({
          kind: "error",
          message: leadCreationErrorMessage(appError),
        });
      }
      mutation.reset();
      return null;
    } finally {
      if (!disposed.current) setBusy(false);
    }
  };

  const submit = async (input: CreateLeadInput) => {
    if (busy || uncertain) return null;
    const intent = intents.current.begin(
      organization.id,
      organization.membershipId,
      input,
    );
    return execute(intent);
  };

  const retry = async () => {
    if (busy) return null;
    const intent = intents.current.current();
    if (!intent) return null;
    return execute(intent);
  };

  const abandon = () => {
    intents.current.forget();
    setUncertain(false);
    setFeedback({
      kind: "abandoned",
      message:
        "Tentativa abandonada. Um novo envio pode registrar outra entrada caso a tentativa anterior tenha sido aplicada.",
    });
    mutation.reset();
  };

  return {
    busy,
    uncertain,
    feedback,
    submit,
    retry,
    abandon,
    clearFeedback: () => setFeedback(null),
  };
}

export type CreateLeadController = ReturnType<typeof useCreateLead>;
