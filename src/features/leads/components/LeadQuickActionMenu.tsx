import * as DialogPrimitive from "@radix-ui/react-dialog";
import { MoreHorizontal, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type {
  LeadReturnReviewItem,
  LeadWorkItem,
  Member,
} from "@/features/leads/api/lead-contracts";
import type { LeadWorkMutationController } from "@/features/leads/hooks/use-lead-work-mutations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/DropdownMenu";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";
import { Textarea } from "@/shared/ui/Textarea";

type Mode = "complete" | "reschedule" | "cancel" | "assignment" | "dismiss";

function localDateTimeValue(): string {
  const date = new Date(Date.now() + 60 * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

const titles: Record<Mode, string> = {
  complete: "Concluir próxima ação",
  reschedule: "Reagendar próxima ação",
  cancel: "Cancelar próxima ação",
  assignment: "Atribuir responsável",
  dismiss: "Dispensar retorno",
};

export function LeadQuickActionMenu({
  variant,
  item,
  review,
  members,
  index,
  controller,
}: {
  variant: "my-actions" | "unassigned" | "return-reviews";
  item: LeadWorkItem;
  review?: LeadReturnReviewItem;
  members: readonly Member[];
  index: number;
  controller: LeadWorkMutationController;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [outcome, setOutcome] = useState("");
  const [dueAt, setDueAt] = useState(localDateTimeValue);
  const [note, setNote] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const busy = controller.phase !== "idle";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    if (mode === "complete") await controller.complete(item, outcome, index);
    if (mode === "reschedule") await controller.reschedule(item, dueAt, index);
    if (mode === "cancel") await controller.cancel(item, note, index);
    if (mode === "assignment" && membershipId)
      await controller.assign(
        item,
        membershipId,
        new Set(members.map((member) => member.id)),
        index,
      );
    if (mode === "dismiss" && review) await controller.dismiss(review, index);
    setMode(null);
  };

  const modes: Mode[] =
    variant === "my-actions"
      ? ["complete", "reschedule", "cancel"]
      : variant === "unassigned"
        ? ["assignment"]
        : ["dismiss"];

  return (
    <DialogPrimitive.Root
      open={mode !== null}
      onOpenChange={(open) => !open && !busy && setMode(null)}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-11"
            aria-label={`Ações rápidas de ${item.displayName}`}
            disabled={busy}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
          {modes.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              className="min-h-11"
              onSelect={() => setMode(candidate)}
            >
              {titles[candidate]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--layer-overlay)] bg-foreground/35 backdrop-blur-[var(--overlay-blur)]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[var(--layer-overlay)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-xl outline-none">
          <DialogPrimitive.Title className="text-lg font-semibold">
            {mode ? titles[mode] : "Ação rápida"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
            A versão atual será confirmada pelo servidor antes de aplicar esta
            ação.
          </DialogPrimitive.Description>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => void submit(event)}
          >
            {mode === "complete" ? (
              <div>
                <Label htmlFor={`work-outcome-${item.id}`}>
                  Resultado opcional
                </Label>
                <Textarea
                  id={`work-outcome-${item.id}`}
                  className="mt-1.5"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  autoFocus
                />
              </div>
            ) : null}
            {mode === "reschedule" ? (
              <div>
                <Label htmlFor={`work-due-${item.id}`}>Nova data e hora</Label>
                <Input
                  id={`work-due-${item.id}`}
                  className="mt-1.5 min-h-11"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  required
                  autoFocus
                />
              </div>
            ) : null}
            {mode === "cancel" ? (
              <div>
                <Label htmlFor={`work-note-${item.id}`}>Motivo opcional</Label>
                <Textarea
                  id={`work-note-${item.id}`}
                  className="mt-1.5"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  autoFocus
                />
              </div>
            ) : null}
            {mode === "assignment" ? (
              <div>
                <Label htmlFor={`work-member-${item.id}`}>
                  Responsável ativo
                </Label>
                <Select
                  id={`work-member-${item.id}`}
                  className="mt-1.5 min-h-11"
                  value={membershipId}
                  onChange={(event) => setMembershipId(event.target.value)}
                  required
                  autoFocus
                >
                  <option value="">Selecione</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {mode === "dismiss" ? (
              <p className="text-sm">
                O Lead permanecerá encerrado e a revisão será registrada como
                dispensada.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={busy}
                >
                  Voltar
                </Button>
              </DialogPrimitive.Close>
              <Button
                type="submit"
                variant={
                  mode === "cancel" || mode === "dismiss" ? "danger" : "default"
                }
                className="min-h-11"
                disabled={
                  busy || (mode === "assignment" && membershipId === "")
                }
              >
                {busy ? "Confirmando…" : "Confirmar"}
              </Button>
            </div>
          </form>
          <DialogPrimitive.Close
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar diálogo"
            disabled={busy}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
