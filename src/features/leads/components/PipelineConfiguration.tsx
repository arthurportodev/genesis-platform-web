import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { Pipeline } from "@/features/leads/api/lead-contracts";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { useLeadApi } from "@/features/leads/hooks/use-lead-queries";
import { activePipelineStages } from "@/features/leads/model/lead-kanban";
import { toAppError } from "@/shared/api/errors";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";

type Mutation =
  | { kind: "create-pipeline"; name: string; stages: string[] }
  | { kind: "rename"; name: string }
  | { kind: "create-stage"; name: string }
  | { kind: "rename-stage"; stageId: string; name: string }
  | { kind: "reorder"; stageIds: string[] }
  | { kind: "archive-stage"; stageId: string };

function errorMessage(error: unknown): string {
  const appError = toAppError(error);
  if (appError.kind === "forbidden")
    return "Seu papel não permite alterar Pipelines.";
  if (appError.kind === "conflict" || appError.kind === "precondition-failed")
    return "O Pipeline mudou. A configuração foi atualizada; revise e tente novamente.";
  if (appError.kind === "validation")
    return "Revise o nome e confirme que a etapa pode ser arquivada.";
  return appError.message;
}

export function PipelineConfiguration({
  pipeline,
  onPipelineCreated,
}: {
  pipeline: Pipeline;
  onPipelineCreated: (pipelineId: string) => void;
}) {
  const organization = useActiveOrganization();
  const api = useLeadApi();
  const queryClient = useQueryClient();
  const [pipelineName, setPipelineName] = useState(pipeline.name);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineStages, setNewPipelineStages] = useState([""]);
  const [newStageName, setNewStageName] = useState("");
  const [stageNames, setStageNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeStages = activePipelineStages(pipeline.stages);
  const mutation = useMutation({
    mutationFn: async (command: Mutation) =>
      command.kind === "create-pipeline"
        ? api.createPipeline({ name: command.name, stages: command.stages })
        : api.mutatePipeline(pipeline, command),
    onSuccess: async (updated, command) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: leadQueryKeys.pipelines(organization.id),
        }),
        queryClient.invalidateQueries({
          queryKey: leadQueryKeys.kanbans(organization.id),
        }),
      ]);
      setError(null);
      setMessage("Configuração salva.");
      if (command.kind === "create-pipeline") onPipelineCreated(updated.id);
    },
    onError: async (cause) => {
      setMessage(null);
      setError(errorMessage(cause));
      await queryClient.invalidateQueries({
        queryKey: leadQueryKeys.pipelines(organization.id),
      });
    },
  });
  const run = (command: Mutation) => {
    setError(null);
    setMessage(null);
    mutation.mutate(command);
  };
  const submit = (event: FormEvent, command: Mutation) => {
    event.preventDefault();
    run(command);
  };
  const moveStage = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= activeStages.length) return;
    const ids = activeStages.map(({ id }) => id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run({ kind: "reorder", stageIds: ids });
  };

  return (
    <details className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        Configurar Pipelines
      </summary>
      <div className="mt-4 space-y-6" aria-busy={mutation.isPending}>
        {message ? (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <form
          className="space-y-2"
          onSubmit={(event) =>
            submit(event, { kind: "rename", name: pipelineName.trim() })
          }
        >
          <Label htmlFor="pipeline-rename">Nome do Pipeline atual</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="pipeline-rename"
              value={pipelineName}
              maxLength={160}
              required
              disabled={mutation.isPending}
              onChange={(event) => setPipelineName(event.target.value)}
            />
            <Button disabled={mutation.isPending || !pipelineName.trim()}>
              Renomear
            </Button>
          </div>
        </form>

        <section aria-labelledby="pipeline-stages-title" className="space-y-3">
          <h3 id="pipeline-stages-title" className="font-semibold">
            Etapas
          </h3>
          {activeStages.map((stage, index) => (
            <div key={stage.id} className="rounded-lg border border-border p-3">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) =>
                  submit(event, {
                    kind: "rename-stage",
                    stageId: stage.id,
                    name: (stageNames[stage.id] ?? stage.name).trim(),
                  })
                }
              >
                <Label className="sr-only" htmlFor={`stage-${stage.id}`}>
                  Nome da etapa
                </Label>
                <Input
                  id={`stage-${stage.id}`}
                  value={stageNames[stage.id] ?? stage.name}
                  maxLength={120}
                  required
                  disabled={mutation.isPending}
                  onChange={(event) =>
                    setStageNames((names) => ({
                      ...names,
                      [stage.id]: event.target.value,
                    }))
                  }
                />
                <Button variant="secondary" disabled={mutation.isPending}>
                  Salvar nome
                </Button>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Mover ${stage.name} para cima`}
                  disabled={mutation.isPending || index === 0}
                  onClick={() => moveStage(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden="true" /> Subir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Mover ${stage.name} para baixo`}
                  disabled={
                    mutation.isPending || index === activeStages.length - 1
                  }
                  onClick={() => moveStage(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden="true" /> Descer
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (
                      globalThis.confirm(
                        "A etapa precisa estar sem oportunidades abertas. Arquivar esta etapa?",
                      )
                    )
                      run({ kind: "archive-stage", stageId: stage.id });
                  }}
                >
                  Arquivar
                </Button>
              </div>
            </div>
          ))}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              submit(event, {
                kind: "create-stage",
                name: newStageName.trim(),
              });
              setNewStageName("");
            }}
          >
            <Label className="sr-only" htmlFor="new-stage">
              Nova etapa
            </Label>
            <Input
              id="new-stage"
              placeholder="Nome da nova etapa"
              value={newStageName}
              maxLength={120}
              required
              disabled={mutation.isPending}
              onChange={(event) => setNewStageName(event.target.value)}
            />
            <Button disabled={mutation.isPending || !newStageName.trim()}>
              <Plus className="size-4" aria-hidden="true" /> Adicionar etapa
            </Button>
          </form>
        </section>

        <form
          className="space-y-3 border-t border-border pt-5"
          onSubmit={(event) =>
            submit(event, {
              kind: "create-pipeline",
              name: newPipelineName.trim(),
              stages: newPipelineStages.map((name) => name.trim()),
            })
          }
        >
          <h3 className="font-semibold">Criar Pipeline</h3>
          <Label htmlFor="new-pipeline-name">Nome do Pipeline</Label>
          <Input
            id="new-pipeline-name"
            value={newPipelineName}
            maxLength={160}
            required
            disabled={mutation.isPending}
            onChange={(event) => setNewPipelineName(event.target.value)}
          />
          {newPipelineStages.map((name, index) => (
            <div key={index}>
              <Label htmlFor={`new-pipeline-stage-${index}`}>
                Etapa {index + 1}
              </Label>
              <Input
                id={`new-pipeline-stage-${index}`}
                value={name}
                maxLength={120}
                required
                disabled={mutation.isPending}
                onChange={(event) =>
                  setNewPipelineStages((stages) =>
                    stages.map((stage, candidate) =>
                      candidate === index ? event.target.value : stage,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setNewPipelineStages((stages) => [...stages, ""])}
            >
              Adicionar outra etapa
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                !newPipelineName.trim() ||
                newPipelineStages.some((name) => !name.trim())
              }
            >
              Criar Pipeline
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}
