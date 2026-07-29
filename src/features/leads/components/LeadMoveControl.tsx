import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { useRef, useState } from "react";

import type {
  LeadListItem,
  LeadStage,
} from "@/features/leads/api/lead-contracts";
import { stageLabels } from "@/features/leads/api/lead-labels";
import { leadMoveDestinations } from "@/features/leads/model/lead-kanban";
import { Button } from "@/shared/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";

export function LeadMoveControl({
  lead,
  disabled,
  onConfirm,
}: {
  lead: LeadListItem;
  disabled: boolean;
  onConfirm: (
    targetStage: LeadStage,
    focusTarget: HTMLElement | null,
  ) => Promise<void>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [targetStage, setTargetStage] = useState<LeadStage | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const destinations = leadMoveDestinations(lead.stage);
  return (
    <DialogPrimitive.Root
      open={confirmationOpen}
      onOpenChange={setConfirmationOpen}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="secondary"
            className="min-h-11"
            disabled={disabled}
            aria-label={`Mover ${lead.displayName} para outra etapa`}
          >
            Mover para <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Escolha a etapa de destino</DropdownMenuLabel>
          {destinations.map((stage) => (
            <DropdownMenuItem
              key={stage}
              className="min-h-11"
              onSelect={() => {
                setTargetStage(stage);
                setConfirmationOpen(true);
              }}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              {stageLabels[stage]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--layer-overlay)] bg-foreground/35 backdrop-blur-[var(--overlay-blur)] data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[var(--layer-overlay)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            confirmRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="text-lg font-semibold">
            Confirmar mudança de etapa
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            Mover {lead.displayName} de {stageLabels[lead.stage]} para{" "}
            {targetStage ? stageLabels[targetStage] : "outra etapa"}? A versão
            atual será verificada antes do comando.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Fechar confirmação</span>
          </DialogPrimitive.Close>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button className="min-h-11" variant="secondary">
                Cancelar
              </Button>
            </DialogPrimitive.Close>
            <Button
              ref={confirmRef}
              className="min-h-11"
              disabled={!targetStage || disabled}
              onClick={() => {
                const target = targetStage;
                if (!target) return;
                setConfirmationOpen(false);
                void onConfirm(target, triggerRef.current);
              }}
            >
              Confirmar movimento
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
