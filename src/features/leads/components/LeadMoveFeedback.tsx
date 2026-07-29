import { X } from "lucide-react";

import type { LeadMoveFeedback as Feedback } from "@/features/leads/hooks/use-lead-mutations";
import { Button } from "@/shared/ui/Button";

export function LeadMoveFeedback({
  feedback,
  onRetry,
  onAbandon,
  onClose,
}: {
  feedback: Feedback | null;
  onRetry: () => void;
  onAbandon: () => void;
  onClose: () => void;
}) {
  if (!feedback) return null;
  const isAlert = feedback.kind === "error" || feedback.kind === "uncertain";
  return (
    <section
      className={`rounded-xl border p-4 text-sm ${
        isAlert
          ? "border-destructive/20 bg-destructive/5"
          : "border-info/20 bg-info/10"
      }`}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
    >
      <div className="flex items-start justify-between gap-3">
        <p>{feedback.message}</p>
        {feedback.kind !== "status" && feedback.kind !== "uncertain" ? (
          <button
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Fechar mensagem"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {feedback.kind === "uncertain" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={onRetry}>
            Tentar novamente
          </Button>
          <Button className="min-h-11" variant="secondary" onClick={onAbandon}>
            Atualizar quadro
          </Button>
        </div>
      ) : null}
    </section>
  );
}
