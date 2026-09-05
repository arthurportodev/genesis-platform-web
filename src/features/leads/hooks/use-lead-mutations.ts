import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  type LeadDetailSnapshot,
  type LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import type {
  LeadInformationInput,
  UpdateLeadInput,
} from "@/features/leads/api/lead-contracts";
import type {
  LeadListItem,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";
import {
  isLeadKanbanAggregateKey,
  leadQueryKeys,
} from "@/features/leads/api/lead-query-keys";
import {
  invalidateLeadMetrics,
  leadActionAffectsMetrics,
} from "@/features/leads/hooks/use-lead-metrics";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import type { IdempotencyKey } from "@/shared/api/idempotency";
import { AppError, toAppError } from "@/shared/api/errors";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export function useLeadMutations(leadId: string) {
  const organization = useActiveOrganization();
  const queryClient = useQueryClient();
  const api = useLeadApi();
  const informationIntentKeys = useRef(new LeadIntentKeyRegistry());

  const refreshLead = async (includeMetrics = false) => {
    const refreshes = [
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.inboxes(organization.id),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.kanbans(organization.id),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.work(organization.id),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.timeline(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.nextAction(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.cycles(organization.id, leadId),
      }),
    ];
    if (includeMetrics)
      refreshes.push(invalidateLeadMetrics(queryClient, organization.id));
    await Promise.all(refreshes);
  };

  const update = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "update",
    ],
    mutationFn: ({
      current,
      body,
    }: {
      current: LeadDetailSnapshot;
      body: UpdateLeadInput;
    }) => api.update(current, body),
    onSuccess: () => refreshLead(false),
  });

  const saveInformation = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "information",
    ],
    mutationFn: async ({
      current,
      body,
    }: {
      current: LeadDetailSnapshot;
      body: LeadInformationInput;
    }) => {
      const commonChanged =
        body.displayName !== current.lead.displayName ||
        body.primaryPhone !== current.lead.primaryPhone ||
        body.email !== current.lead.email ||
        body.companyName !== current.lead.companyName ||
        body.instagram !== current.lead.instagram ||
        body.city !== current.lead.city ||
        body.serviceInterest !== current.lead.serviceInterest;
      const financialChanged =
        body.expectedValueMinor !== current.lead.latestCycle.expectedValueMinor;
      if (!commonChanged && !financialChanged) return { changed: false };

      if (!financialChanged) {
        const commonBody: UpdateLeadInput = {
          displayName: body.displayName,
          primaryPhone: body.primaryPhone,
          email: body.email,
          companyName: body.companyName,
          instagram: body.instagram,
          city: body.city,
          serviceInterest: body.serviceInterest,
        };
        await api.update(current, commonBody);
        return { changed: true };
      }

      const intent: LeadIdempotentAction = commonChanged
        ? { action: "information", body }
        : {
            action: "expected-value",
            body: { expectedValueMinor: body.expectedValueMinor },
          };
      const name = `information:${organization.id}:${leadId}`;
      const idempotencyKey = informationIntentKeys.current.keyFor(
        name,
        intent,
        current.lead.revision,
      );
      try {
        await api.act(current, intent, idempotencyKey);
        informationIntentKeys.current.forget(name);
        return { changed: true };
      } catch (error) {
        const appError = toAppError(error);
        if (!hasUncertainMutationOutcome(appError.kind))
          informationIntentKeys.current.forget(name);
        throw error;
      }
    },
    onSuccess: (result) => (result.changed ? refreshLead(false) : undefined),
  });

  const assign = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "assign",
    ],
    mutationFn: ({
      current,
      responsibleMembershipId,
    }: {
      current: LeadDetailSnapshot;
      responsibleMembershipId: string | null;
    }) => api.assign(current, responsibleMembershipId),
    onSuccess: () => refreshLead(true),
  });

  const act = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      leadId,
      "action",
    ],
    mutationFn: ({
      current,
      intent,
      idempotencyKey,
    }: {
      current: LeadDetailSnapshot;
      intent: LeadIdempotentAction;
      idempotencyKey: IdempotencyKey;
    }) => api.act(current, intent, idempotencyKey),
    onSuccess: (_receipt, variables) =>
      refreshLead(leadActionAffectsMetrics(variables.intent.action)),
  });

  return { update, saveInformation, assign, act, refreshLead };
}

export type LeadMovePhase =
  "idle" | "verifying" | "moving" | "refreshing" | "uncertain";

export interface LeadMoveFeedback {
  kind: "status" | "success" | "error" | "uncertain";
  message: string;
}

interface PreparedMove {
  name: string;
  card: LeadListItem;
  targetStage: LeadStage;
  current: LeadDetailSnapshot;
  intent: Extract<LeadIdempotentAction, { action: "move" }>;
  idempotencyKey: IdempotencyKey;
  focusTarget: HTMLElement | null;
}

function compatibleMoveSnapshot(
  current: LeadDetailSnapshot,
  card: LeadListItem,
): boolean {
  return (
    current.lead.id === card.id &&
    current.snapshot.leadId === card.id &&
    current.lead.revision === card.revision &&
    current.snapshot.revision === card.revision &&
    current.lead.status === "active" &&
    current.lead.stage === card.stage &&
    current.lead.responsibleMembershipId === card.responsibleMembershipId
  );
}

export function useLeadPipelineMove() {
  const organization = useActiveOrganization();
  const queryClient = useQueryClient();
  const api = useLeadApi();
  const intentKeys = useRef(new LeadIntentKeyRegistry());
  const attempt = useRef<{
    card: LeadListItem;
    targetStage: LeadStage;
    focusTarget: HTMLElement | null;
  } | null>(null);
  const prepared = useRef<PreparedMove | null>(null);
  const commandStarted = useRef(false);
  const [phase, setPhase] = useState<LeadMovePhase>("idle");
  const [feedback, setFeedback] = useState<LeadMoveFeedback | null>(null);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationKey: [
      ...leadQueryKeys.root(organization.id),
      "mutation",
      "pipeline-move",
    ],
    mutationFn: async (
      variables:
        | {
            mode: "new";
            card: LeadListItem;
            targetStage: LeadStage;
            focusTarget: HTMLElement | null;
          }
        | { mode: "retry"; prepared: PreparedMove },
    ) => {
      if (variables.mode === "retry") {
        prepared.current = variables.prepared;
        commandStarted.current = true;
        setPhase("moving");
        setFeedback({ kind: "status", message: "Movendo Lead" });
        return api.act(
          variables.prepared.current,
          variables.prepared.intent,
          variables.prepared.idempotencyKey,
        );
      }

      if (variables.targetStage === variables.card.stage)
        throw new AppError("validation", "Selecione uma etapa diferente.");
      setPhase("verifying");
      setFeedback({ kind: "status", message: "Verificando versão atual" });
      const detailKey = leadQueryKeys.detail(
        organization.id,
        variables.card.id,
      );
      let current = queryClient.getQueryData<LeadDetailSnapshot>(detailKey);
      if (!current || !compatibleMoveSnapshot(current, variables.card)) {
        current = await api.detail(variables.card.id);
        queryClient.setQueryData(detailKey, current);
      }
      if (!compatibleMoveSnapshot(current, variables.card)) {
        throw new AppError(
          "precondition-failed",
          "Este Lead mudou. O Pipeline foi atualizado; confirme uma nova intenção.",
        );
      }
      const intent = {
        action: "move",
        body: { stage: variables.targetStage },
      } as const;
      const name = `pipeline:${organization.id}:${variables.card.id}`;
      const idempotencyKey = intentKeys.current.keyFor(
        name,
        intent,
        variables.card.revision,
      );
      prepared.current = {
        name,
        card: variables.card,
        targetStage: variables.targetStage,
        current,
        intent,
        idempotencyKey,
        focusTarget: variables.focusTarget,
      };
      commandStarted.current = true;
      setPhase("moving");
      setFeedback({ kind: "status", message: "Movendo Lead" });
      return api.act(current, intent, idempotencyKey);
    },
  });

  const refreshBoard = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        isLeadKanbanAggregateKey(organization.id, query.queryKey),
    });
  };

  const invalidateAfterMove = async (leadId: string) => {
    await Promise.all([
      refreshBoard(),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.inboxes(organization.id),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(organization.id, leadId),
      }),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.timeline(organization.id, leadId),
      }),
    ]);
  };

  const refreshAfterDeterministicFailure = async (leadId: string) => {
    await Promise.all([
      refreshBoard(),
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(organization.id, leadId),
      }),
    ]);
  };

  const completeSuccess = async (move: PreparedMove) => {
    intentKeys.current.forget(move.name);
    attempt.current = null;
    prepared.current = null;
    commandStarted.current = false;
    setPhase("refreshing");
    setFeedback({ kind: "status", message: "Atualizando o Pipeline" });
    await invalidateAfterMove(move.card.id);
    setBusyLeadId(null);
    setPhase("idle");
    setFeedback({
      kind: "success",
      message: "Lead movido com sucesso.",
    });
    globalThis.setTimeout(() => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-pipeline-column-heading="${move.targetStage}"]`,
        ),
      );
      (
        headings.find((heading) => heading.offsetParent !== null) ?? headings[0]
      )?.focus();
    }, 0);
  };

  const handleFailure = async (error: unknown) => {
    const appError = toAppError(error);
    const move = prepared.current;
    const currentAttempt = attempt.current;
    if (
      move &&
      commandStarted.current &&
      hasUncertainMutationOutcome(appError.kind)
    ) {
      setPhase("uncertain");
      setFeedback({
        kind: "uncertain",
        message:
          "Não foi possível confirmar o resultado remoto. Tente novamente com a mesma intenção ou atualize o quadro.",
      });
      return;
    }

    if (move) intentKeys.current.forget(move.name);
    prepared.current = null;
    commandStarted.current = false;
    attempt.current = null;
    setBusyLeadId(null);
    setPhase("idle");
    if (
      appError.kind === "conflict" ||
      appError.kind === "precondition-failed"
    ) {
      if (move?.card.id ?? currentAttempt?.card.id)
        await refreshAfterDeterministicFailure(
          move?.card.id ?? (currentAttempt?.card.id as string),
        );
      setFeedback({
        kind: "error",
        message:
          appError.kind === "precondition-failed"
            ? "Este Lead foi atualizado por outra operação. Revise o quadro e confirme uma nova intenção."
            : "O estágio ou o estado deste Lead mudou. Revise o quadro e confirme uma nova intenção.",
      });
      globalThis.setTimeout(
        () => (move?.focusTarget ?? currentAttempt?.focusTarget)?.focus(),
        0,
      );
      return;
    }
    if (appError.kind === "not-found" && (move || currentAttempt)) {
      await refreshBoard();
      setFeedback({
        kind: "error",
        message: "Este Lead não está mais disponível. O quadro foi atualizado.",
      });
    } else if (appError.kind === "forbidden") {
      setFeedback({
        kind: "error",
        message: "Seu acesso ao Lead mudou. A Organization foi reavaliada.",
      });
    } else {
      setFeedback({ kind: "error", message: appError.message });
    }
    globalThis.setTimeout(
      () => (move?.focusTarget ?? currentAttempt?.focusTarget)?.focus(),
      0,
    );
  };

  const confirmMove = async (
    card: LeadListItem,
    targetStage: LeadStage,
    focusTarget: HTMLElement | null,
  ) => {
    prepared.current = null;
    commandStarted.current = false;
    attempt.current = { card, targetStage, focusTarget };
    setBusyLeadId(card.id);
    setFeedback(null);
    try {
      await mutation.mutateAsync({
        mode: "new",
        card,
        targetStage,
        focusTarget,
      });
      const move = prepared.current;
      if (move) await completeSuccess(move);
    } catch (error) {
      await handleFailure(error);
    }
  };

  const retry = async () => {
    const move = prepared.current;
    if (!move) return;
    try {
      await mutation.mutateAsync({ mode: "retry", prepared: move });
      await completeSuccess(move);
    } catch (error) {
      await handleFailure(error);
    }
  };

  const abandon = async () => {
    const move = prepared.current;
    if (!move) return;
    intentKeys.current.forget(move.name);
    attempt.current = null;
    prepared.current = null;
    commandStarted.current = false;
    setBusyLeadId(null);
    setPhase("refreshing");
    setFeedback({ kind: "status", message: "Atualizando o Pipeline" });
    await refreshAfterDeterministicFailure(move.card.id);
    setPhase("idle");
    setFeedback({
      kind: "status",
      message: "A intenção anterior foi abandonada e o quadro foi atualizado.",
    });
    globalThis.setTimeout(() => move.focusTarget?.focus(), 0);
  };

  return {
    phase,
    feedback,
    busyLeadId,
    confirmMove,
    retry,
    abandon,
    clearFeedback: () => setFeedback(null),
  };
}

export type LeadPipelineMoveController = ReturnType<typeof useLeadPipelineMove>;
