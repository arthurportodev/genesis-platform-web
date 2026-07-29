import type { LeadCreateFeedback as Feedback } from "@/features/leads/hooks/use-create-lead";
import { Button } from "@/shared/ui/Button";

export function LeadCreateFeedback({
  feedback,
  busy,
  onRetry,
  onAbandon,
}: {
  feedback: Feedback | null;
  busy: boolean;
  onRetry: () => void;
  onAbandon: () => void;
}) {
  if (!feedback) return null;
  if (feedback.kind === "uncertain")
    return (
      <section
        className="rounded-xl border border-warning/30 bg-warning/10 p-4"
        aria-labelledby="lead-create-uncertain-title"
        aria-live="assertive"
      >
        <h2 id="lead-create-uncertain-title" className="font-semibold">
          Resultado não confirmado
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {feedback.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={onRetry}
          >
            Tentar confirmar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={onAbandon}
          >
            Abandonar tentativa
          </Button>
        </div>
      </section>
    );
  return (
    <p
      className={
        feedback.kind === "error"
          ? "rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
          : "rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
      }
      role={feedback.kind === "error" ? "alert" : "status"}
      aria-live={feedback.kind === "error" ? "assertive" : "polite"}
    >
      {feedback.message}
    </p>
  );
}
