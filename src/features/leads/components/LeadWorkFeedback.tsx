import type { LeadWorkMutationController } from "@/features/leads/hooks/use-lead-work-mutations";
import { Button } from "@/shared/ui/Button";

export function LeadWorkFeedback({
  controller,
}: {
  controller: LeadWorkMutationController;
}) {
  const feedback = controller.feedback;
  if (!feedback) return null;
  const uncertain = feedback.kind === "uncertain";
  return (
    <section
      className={`rounded-xl border p-4 ${
        feedback.kind === "error" || uncertain
          ? "border-destructive/25 bg-destructive/5"
          : "border-info/25 bg-info/10"
      }`}
      role={feedback.kind === "error" || uncertain ? "alert" : "status"}
      aria-live={
        feedback.kind === "error" || uncertain ? "assertive" : "polite"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{feedback.message}</p>
        {uncertain ? (
          <div className="flex flex-wrap gap-2">
            {feedback.canRetry ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => void controller.retry()}
              >
                Tentar novamente
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => void controller.verify()}
            >
              Verificar estado
            </Button>
            {feedback.canAbandon ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => void controller.abandon()}
              >
                Abandonar tentativa
              </Button>
            ) : null}
          </div>
        ) : (feedback.kind === "success" || feedback.kind === "error") &&
          controller.phase !== "cooldown" ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={controller.clearFeedback}
          >
            Fechar aviso
          </Button>
        ) : null}
      </div>
    </section>
  );
}
