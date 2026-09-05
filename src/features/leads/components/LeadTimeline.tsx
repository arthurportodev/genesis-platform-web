import { Clock3 } from "lucide-react";

import {
  formatDateTime,
  timelineEventLabel,
} from "@/features/leads/api/lead-labels";
import { useLeadTimelineQuery } from "@/features/leads/hooks/use-lead-queries";
import { formatBrlMinorUnits } from "@/features/leads/model/lead-money";
import { OperationalState } from "@/shared/components/OperationalState";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";

export function LeadTimeline({ leadId }: { leadId: string }) {
  const timeline = useLeadTimelineQuery(leadId);
  const items = timeline.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="timeline-title">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="timeline-title" className="text-lg font-semibold">
            Histórico
          </h2>
          <p className="text-sm text-muted-foreground">
            Histórico em ordem cronológica
          </p>
        </div>
      </div>
      {timeline.isPending ? (
        <OperationalState
          kind="loading"
          compact
          title="Carregando histórico"
          description="Consultando os eventos deste Lead."
        />
      ) : timeline.isError ? (
        <OperationalState
          kind="error"
          compact
          title="Histórico indisponível"
          description="Não foi possível carregar os eventos agora."
        />
      ) : items.length === 0 ? (
        <OperationalState
          kind="empty"
          compact
          title="Sem eventos"
          description="O histórico deste Lead ainda está vazio."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="relative p-4 pl-11">
              <span className="absolute left-4 top-4 grid size-6 place-items-center rounded-full bg-muted text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
              </span>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">
                  {timelineEventLabel(item.eventType)}
                </h3>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={item.occurredAt}
                >
                  {formatDateTime(item.occurredAt)}
                </time>
              </div>
              {item.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.note.content}
                </p>
              ) : null}
              {item.activity ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.activity.type.replaceAll("_", " ")}
                  {item.activity.outcome ? ` · ${item.activity.outcome}` : ""}
                </p>
              ) : null}
              {item.nextAction ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.nextAction.description} ·{" "}
                  {formatDateTime(item.nextAction.dueAt)}
                </p>
              ) : null}
              {item.eventType === "lead.expected_value.changed" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.previousExpectedValueMinor === null
                    ? "Não informado"
                    : formatBrlMinorUnits(item.previousExpectedValueMinor)}{" "}
                  →{" "}
                  {item.newExpectedValueMinor === null
                    ? "Não informado"
                    : formatBrlMinorUnits(item.newExpectedValueMinor)}
                </p>
              ) : null}
            </Card>
          ))}
          {timeline.hasNextPage ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={timeline.isFetchingNextPage}
              onClick={() => void timeline.fetchNextPage()}
            >
              {timeline.isFetchingNextPage
                ? "Carregando…"
                : "Carregar mais eventos"}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
