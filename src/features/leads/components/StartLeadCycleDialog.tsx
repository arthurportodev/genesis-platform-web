import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";

import type { Pipeline } from "@/features/leads/api/lead-contracts";
import type { LeadDetailSnapshot } from "@/features/leads/api/lead-api";
import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";
import { useLeadMutations } from "@/features/leads/hooks/use-lead-mutations";
import { toAppError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/Button";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";

export function StartLeadCycleDialog({
  current,
  pipelines,
}: {
  current: LeadDetailSnapshot;
  pipelines: readonly Pipeline[];
}) {
  const mutations = useLeadMutations(current.lead.id);
  const intentKeys = useRef(new LeadIntentKeyRegistry());
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState(
    pipelines.find((pipeline) => pipeline.isDefault)?.id ??
      pipelines[0]?.id ??
      "",
  );
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const run = async () => {
    if (!pipelineId) return;
    const intent = { action: "start-cycle", body: { pipelineId } } as const;
    const name = `start-cycle:${current.lead.id}`;
    const key = intentKeys.current.keyFor(name, intent, current.lead.revision);
    setError(null);
    try {
      await mutations.act.mutateAsync({ current, intent, idempotencyKey: key });
      intentKeys.current.forget(name);
      setUncertain(false);
      setOpen(false);
    } catch (cause) {
      const appError = toAppError(cause);
      const remoteUncertain = hasUncertainMutationOutcome(appError.kind);
      if (!remoteUncertain) intentKeys.current.forget(name);
      setUncertain(remoteUncertain);
      setError(
        remoteUncertain
          ? "Não foi possível confirmar o resultado. Tente novamente com a mesma intenção ou atualize o detalhe."
          : appError.kind === "conflict" ||
              appError.kind === "precondition-failed"
            ? "O Lead mudou. Atualize o detalhe e confirme uma nova intenção."
            : appError.message,
      );
    }
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" /> Adicionar ao Pipeline
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--layer-overlay)] bg-foreground/35" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[var(--layer-overlay)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Adicionar ao Pipeline
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            O serviço iniciará o ciclo no primeiro estágio ativo do Pipeline
            escolhido.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg"
            aria-label="Fechar"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
          <div className="mt-5 space-y-2">
            <Label htmlFor="start-cycle-pipeline">Pipeline</Label>
            <Select
              id="start-cycle-pipeline"
              className="min-h-11"
              value={pipelineId}
              disabled={mutations.act.isPending || uncertain}
              onChange={(event) => setPipelineId(event.target.value)}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </Select>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {uncertain ? (
              <Button
                variant="secondary"
                onClick={() => void mutations.refreshLead()}
              >
                Atualizar detalhe
              </Button>
            ) : (
              <DialogPrimitive.Close asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogPrimitive.Close>
            )}
            <Button
              disabled={!pipelineId || mutations.act.isPending}
              onClick={() => void run()}
            >
              {mutations.act.isPending
                ? "Adicionando…"
                : uncertain
                  ? "Tentar novamente"
                  : "Confirmar"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
