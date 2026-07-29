import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type {
  LeadDetailSnapshot,
  LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import type {
  LeadReturnReviewItem,
  LeadWorkItem,
} from "@/features/leads/api/lead-contracts";
import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import {
  assertAssignmentPreflight,
  assertDismissPreflight,
  assertNextActionPreflight,
  compatibleWorkDetail,
} from "@/features/leads/api/lead-work-preflight";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import { toAppError } from "@/shared/api/errors";
import { environment } from "@/shared/config/environment";
import type { IdempotencyKey } from "@/shared/api/idempotency";
import { useActiveOrganization } from "@/shared/organization/active-organization";

export type LeadWorkCommand =
  "complete" | "reschedule" | "cancel" | "assignment" | "dismiss";

export type LeadWorkPhase =
  "idle" | "verifying" | "submitting" | "refreshing" | "uncertain" | "cooldown";

export interface LeadWorkFeedback {
  kind: "status" | "success" | "error" | "uncertain";
  message: string;
  canRetry?: boolean;
  canAbandon?: boolean;
}

interface PreparedBase {
  command: LeadWorkCommand;
  name: string;
  leadId: string;
  current: LeadDetailSnapshot;
  focusIndex: number;
}

interface PreparedIdempotent extends PreparedBase {
  mode: "idempotent";
  intent: LeadIdempotentAction;
  idempotencyKey: IdempotencyKey;
}

interface PreparedAssignment extends PreparedBase {
  mode: "assignment";
  responsibleMembershipId: string;
}

type PreparedWorkCommand = PreparedIdempotent | PreparedAssignment;

function normalizeOptional(value: string): string | undefined {
  const normalized = value.normalize("NFC").trim();
  return normalized === "" ? undefined : normalized;
}

function restoreQueueFocus(focusIndex: number): void {
  globalThis.setTimeout(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-lead-work-item]"),
    ).filter(
      (item) =>
        item.offsetParent !== null || item.dataset.testVisible === "true",
    );
    const target = items[focusIndex] ?? items[focusIndex - 1];
    if (target) {
      target.focus();
      return;
    }
    document.querySelector<HTMLElement>("[data-lead-work-heading]")?.focus();
  }, 0);
}

export function useLeadWorkMutations() {
  const organization = useActiveOrganization();
  const queryClient = useQueryClient();
  const api = useLeadApi();
  const keys = useRef(new LeadIntentKeyRegistry());
  const prepared = useRef<PreparedWorkCommand | null>(null);
  const commandStarted = useRef(false);
  const locked = useRef(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<LeadWorkPhase>("idle");
  const [feedback, setFeedback] = useState<LeadWorkFeedback | null>(null);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (cooldownTimer.current) globalThis.clearTimeout(cooldownTimer.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationKey: [...leadQueryKeys.work(organization.id), "mutation"],
    mutationFn: (command: PreparedWorkCommand) => {
      commandStarted.current = true;
      setPhase("submitting");
      setFeedback({ kind: "status", message: "Confirmando com o servidor…" });
      return command.mode === "assignment"
        ? api.assign(command.current, command.responsibleMembershipId)
        : api.act(command.current, command.intent, command.idempotencyKey);
    },
  });

  const detailFor = async (item: LeadWorkItem) => {
    const key = leadQueryKeys.detail(organization.id, item.id);
    let current = queryClient.getQueryData<LeadDetailSnapshot>(key);
    if (!current || !compatibleWorkDetail(current, item)) {
      current = await api.detail(item.id);
      queryClient.setQueryData(key, current);
    }
    return current;
  };

  const invalidate = async (
    command: LeadWorkCommand,
    leadId: string,
    throwOnError = false,
  ) => {
    const invalidateQuery = (queryKey: readonly unknown[]) =>
      queryClient.invalidateQueries({ queryKey }, { throwOnError });
    const common = [
      invalidateQuery(leadQueryKeys.inboxes(organization.id)),
      invalidateQuery(leadQueryKeys.kanbans(organization.id)),
      invalidateQuery(leadQueryKeys.detail(organization.id, leadId)),
      invalidateQuery(leadQueryKeys.timeline(organization.id, leadId)),
    ];
    if (command === "dismiss") {
      await Promise.all([
        ...common,
        invalidateQuery(leadQueryKeys.returnReviewQueues(organization.id)),
      ]);
      return;
    }
    await Promise.all([
      ...common,
      invalidateQuery(leadQueryKeys.myActionsRoot(organization.id)),
      invalidateQuery(leadQueryKeys.nextAction(organization.id, leadId)),
      ...(command === "assignment"
        ? [invalidateQuery(leadQueryKeys.unassignedQueues(organization.id))]
        : []),
    ]);
  };

  const refreshDetailAndState = async (
    command: LeadWorkCommand,
    leadId: string,
    throwOnError = false,
  ) => {
    const current = await api.detail(leadId);
    queryClient.setQueryData(
      leadQueryKeys.detail(organization.id, leadId),
      current,
    );
    await invalidate(command, leadId, throwOnError);
  };

  const clearPrepared = (command: PreparedWorkCommand | null) => {
    if (command?.mode === "idempotent") keys.current.forget(command.name);
    prepared.current = null;
    commandStarted.current = false;
    locked.current = false;
  };

  const enterCooldown = () => {
    locked.current = true;
    setPhase("cooldown");
    setFeedback({
      kind: "error",
      message:
        "Muitas tentativas. As ações ficam bloqueadas durante o cooldown local.",
    });
    if (cooldownTimer.current) globalThis.clearTimeout(cooldownTimer.current);
    cooldownTimer.current = globalThis.setTimeout(() => {
      cooldownTimer.current = null;
      locked.current = false;
      setPhase("idle");
    }, environment.rateLimitCooldownMs);
  };

  const completeSuccess = async (command: PreparedWorkCommand) => {
    clearPrepared(command);
    setPhase("refreshing");
    setFeedback({ kind: "status", message: "Atualizando a fila…" });
    await invalidate(command.command, command.leadId);
    setBusyLeadId(null);
    setPhase("idle");
    setFeedback({
      kind: "success",
      message:
        command.command === "assignment"
          ? "Lead atribuído e fila atualizada."
          : command.command === "dismiss"
            ? "Retorno dispensado e removido da fila."
            : "Próxima ação atualizada e fila reorganizada.",
    });
    restoreQueueFocus(command.focusIndex);
  };

  const handleFailure = async (cause: unknown) => {
    const error = toAppError(cause);
    const command = prepared.current;
    let refreshFailed = false;
    if (
      command &&
      commandStarted.current &&
      hasUncertainMutationOutcome(error.kind)
    ) {
      setPhase("uncertain");
      setFeedback({
        kind: "uncertain",
        canRetry: command.mode === "idempotent",
        canAbandon: command.mode === "idempotent",
        message:
          command.mode === "assignment"
            ? "O resultado da atribuição não foi confirmado. Verifique o estado antes de criar outra intenção."
            : "O resultado remoto não foi confirmado. A intenção exata foi preservada.",
      });
      return false;
    }

    clearPrepared(command);
    setBusyLeadId(null);
    if (command) {
      if (
        error.kind === "precondition-failed" ||
        error.kind === "conflict" ||
        error.kind === "precondition-required"
      ) {
        try {
          await refreshDetailAndState(command.command, command.leadId, true);
        } catch {
          refreshFailed = true;
          await invalidate(command.command, command.leadId);
        }
      } else {
        await invalidate(command.command, command.leadId);
      }
    }
    if (error.kind === "rate-limited") {
      enterCooldown();
    } else if (
      error.kind === "precondition-failed" ||
      error.kind === "conflict"
    ) {
      setPhase("idle");
      setFeedback({
        kind: "error",
        message: refreshFailed
          ? "O Lead mudou, mas a fila não pôde ser atualizada. Tente o refresh antes de confirmar outra intenção."
          : error.kind === "precondition-failed"
            ? "Este Lead mudou. Os dados foram atualizados; revise os valores e confirme uma nova intenção."
            : "O estado do Lead ou a intenção mudou. Revise os dados antes de continuar.",
      });
    } else if (error.kind === "forbidden") {
      setPhase("idle");
      setFeedback({
        kind: "error",
        message:
          "Seu acesso mudou. A Organization e as filas foram reavaliadas.",
      });
    } else if (error.kind === "not-found") {
      setPhase("idle");
      setFeedback({
        kind: "error",
        message: "O Lead não está mais disponível nesta fila.",
      });
    } else if (error.kind === "server") {
      setPhase("idle");
      setFeedback({
        kind: "error",
        message:
          "A operação está temporariamente indisponível. Os itens carregados foram preservados.",
      });
    } else {
      setPhase("idle");
      setFeedback({ kind: "error", message: error.message });
    }
    if (command) restoreQueueFocus(command.focusIndex);
    return false;
  };

  const execute = async (command: PreparedWorkCommand) => {
    prepared.current = command;
    setBusyLeadId(command.leadId);
    try {
      await mutation.mutateAsync(command);
      await completeSuccess(command);
      return true;
    } catch (cause) {
      return handleFailure(cause);
    }
  };

  const prepareNextAction = async (
    command: "complete" | "reschedule" | "cancel",
    item: LeadWorkItem,
    intent: LeadIdempotentAction,
    focusIndex: number,
  ): Promise<PreparedIdempotent> => {
    setPhase("verifying");
    setFeedback({ kind: "status", message: "Verificando a versão atual…" });
    const current = await detailFor(item);
    assertNextActionPreflight(current, item);
    const nextAction = item.nextAction;
    if (!nextAction) throw new Error("Next Action ausente após preflight.");
    const name = `work:${organization.id}:${item.id}:${command}`;
    const context = {
      organizationId: organization.id,
      actorMembershipId: organization.membershipId,
      leadId: item.id,
      leadRevision: item.revision,
      etag: current.snapshot.etag,
      nextActionId: nextAction.id,
      nextActionRevision: nextAction.revision,
    };
    return {
      mode: "idempotent",
      command,
      name,
      leadId: item.id,
      current,
      intent,
      idempotencyKey: keys.current.keyFor(name, intent, item.revision, context),
      focusIndex,
    };
  };

  const start = async (prepare: () => Promise<PreparedWorkCommand>) => {
    if (locked.current) {
      setFeedback({
        kind: "error",
        message:
          "Conclua ou verifique a operação atual antes de iniciar outra.",
      });
      return false;
    }
    locked.current = true;
    prepared.current = null;
    commandStarted.current = false;
    setFeedback(null);
    try {
      return await execute(await prepare());
    } catch (cause) {
      return handleFailure(cause);
    }
  };

  const complete = (
    item: LeadWorkItem,
    outcome: string,
    focusIndex: number,
  ) => {
    const normalizedOutcome = normalizeOptional(outcome);
    const performedAt = new Date().toISOString();
    const intent: LeadIdempotentAction = {
      action: "next-action-complete",
      body: {
        performedAt,
        ...(normalizedOutcome ? { outcome: normalizedOutcome } : {}),
      },
    };
    return start(() => prepareNextAction("complete", item, intent, focusIndex));
  };

  const reschedule = (
    item: LeadWorkItem,
    dueAt: string,
    focusIndex: number,
  ) => {
    const normalizedDueAt = new Date(dueAt).toISOString();
    const intent: LeadIdempotentAction = {
      action: "next-action-reschedule",
      body: { dueAt: normalizedDueAt },
    };
    return start(() =>
      prepareNextAction("reschedule", item, intent, focusIndex),
    );
  };

  const cancel = (item: LeadWorkItem, note: string, focusIndex: number) => {
    const normalizedNote = normalizeOptional(note);
    const intent: LeadIdempotentAction = {
      action: "next-action-cancel",
      body: normalizedNote ? { note: normalizedNote } : {},
    };
    return start(() => prepareNextAction("cancel", item, intent, focusIndex));
  };

  const assign = (
    item: LeadWorkItem,
    responsibleMembershipId: string,
    allowedMembershipIds: ReadonlySet<string>,
    focusIndex: number,
  ) =>
    start(async () => {
      setPhase("verifying");
      setFeedback({ kind: "status", message: "Verificando a versão atual…" });
      const current = await detailFor(item);
      assertAssignmentPreflight(
        current,
        item,
        responsibleMembershipId,
        allowedMembershipIds,
      );
      return {
        mode: "assignment",
        command: "assignment",
        name: `work:${organization.id}:${item.id}:assignment`,
        leadId: item.id,
        current,
        responsibleMembershipId,
        focusIndex,
      };
    });

  const dismiss = (item: LeadReturnReviewItem, focusIndex: number) =>
    start(async () => {
      setPhase("verifying");
      setFeedback({ kind: "status", message: "Verificando a revisão atual…" });
      const current = await detailFor(item.lead);
      assertDismissPreflight(current, item);
      const intent: LeadIdempotentAction = {
        action: "dismiss-return",
        body: {},
      };
      const name = `work:${organization.id}:${item.lead.id}:dismiss`;
      return {
        mode: "idempotent",
        command: "dismiss",
        name,
        leadId: item.lead.id,
        current,
        intent,
        idempotencyKey: keys.current.keyFor(name, intent, item.lead.revision, {
          organizationId: organization.id,
          actorMembershipId: organization.membershipId,
          leadId: item.lead.id,
          leadRevision: item.lead.revision,
          etag: current.snapshot.etag,
          pendingReturnId: item.review.id,
        }),
        focusIndex,
      };
    });

  const retry = async () => {
    const command = prepared.current;
    if (!command || command.mode !== "idempotent") return;
    try {
      await mutation.mutateAsync(command);
      await completeSuccess(command);
    } catch (cause) {
      await handleFailure(cause);
    }
  };

  const verify = async () => {
    const command = prepared.current;
    if (!command) return;
    setPhase("refreshing");
    setFeedback({ kind: "status", message: "Verificando o estado atual…" });
    try {
      await refreshDetailAndState(command.command, command.leadId, true);
      clearPrepared(command);
      setBusyLeadId(null);
      setPhase("idle");
      setFeedback({
        kind: "status",
        message:
          "Estado atualizado. Revise a fila antes de criar outra intenção.",
      });
      restoreQueueFocus(command.focusIndex);
    } catch {
      setPhase("uncertain");
      setFeedback({
        kind: "uncertain",
        canRetry: command.mode === "idempotent",
        canAbandon: command.mode === "idempotent",
        message:
          "Não foi possível verificar o estado. A operação permanece bloqueada.",
      });
    }
  };

  const abandon = () => {
    const command = prepared.current;
    if (!command || command.mode !== "idempotent") return;
    clearPrepared(command);
    setBusyLeadId(null);
    setPhase("idle");
    setFeedback({
      kind: "status",
      message:
        "A tentativa local foi abandonada. Nenhuma nova requisição foi enviada.",
    });
    restoreQueueFocus(command.focusIndex);
  };

  return {
    phase,
    feedback,
    busyLeadId,
    complete,
    reschedule,
    cancel,
    assign,
    dismiss,
    retry,
    verify,
    abandon,
    clearFeedback: () => setFeedback(null),
  };
}

export type LeadWorkMutationController = ReturnType<
  typeof useLeadWorkMutations
>;
