import { QueryClient } from "@tanstack/react-query";

import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import {
  invalidateLeadMetrics,
  leadActionAffectsMetrics,
} from "@/features/leads/hooks/use-lead-metrics";

it("invalida somente a sub-raiz tenant-scoped de Metrics", async () => {
  const client = new QueryClient();
  const metrics = leadQueryKeys.metrics("org-a", { kind: "default" });
  const inbox = leadQueryKeys.inboxes("org-a");
  const otherTenant = leadQueryKeys.metrics("org-b", { kind: "default" });
  client.setQueryData(metrics, { value: 1 });
  client.setQueryData(inbox, { value: 2 });
  client.setQueryData(otherTenant, { value: 3 });

  await invalidateLeadMetrics(client, "org-a");

  expect(client.getQueryState(metrics)?.isInvalidated).toBe(true);
  expect(client.getQueryState(inbox)?.isInvalidated).toBe(false);
  expect(client.getQueryState(otherTenant)?.isInvalidated).toBe(false);
});

it("classifica somente comandos que alteram contadores", () => {
  for (const action of [
    "next-action-create",
    "next-action-reschedule",
    "next-action-complete",
    "next-action-cancel",
    "win",
    "lose",
    "archive",
    "reactivate",
    "dismiss-return",
  ] as const)
    expect(leadActionAffectsMetrics(action)).toBe(true);
  for (const action of ["move", "activity", "note"] as const)
    expect(leadActionAffectsMetrics(action)).toBe(false);
});
