import {
  createLeadApi,
  type LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import { leadDetailSchema } from "@/features/leads/api/lead-contracts";
import { createLeadSnapshot } from "@/features/leads/api/lead-snapshot";
import type { AuthenticatedHttpClient } from "@/shared/api/contracts";
import { createIdempotencyKey } from "@/shared/api/idempotency";
import { testLead, testMemberId } from "@/test/msw/lead-handlers";
import { testLeadView } from "@/test/msw/lead-handlers";
import { testLeadListItem } from "@/test/msw/lead-handlers";
import { testMetricsSummary } from "@/test/msw/lead-handlers";

const createdId = "00000000-0000-4000-8000-000000000099";
const currentStrongEtag = `"lead:${testLead.id}:${testLead.revision}"`;

function setup() {
  const request = vi.fn((path: string, options: { method?: string }) => {
    if (options.method === "PATCH") {
      return {
        data: testLead,
        status: 200,
        etag: '"opaque-lead-etag-4"',
      };
    }
    if (path.endsWith("/information")) {
      return {
        data: testLeadView,
        status: 200,
        etag: '"opaque-lead-etag-5"',
        idempotencyReplayed: false,
      };
    }
    return {
      data: { id: createdId },
      status: 201,
      etag: '"opaque-lead-etag-4"',
      idempotencyReplayed: false,
    };
  });
  const http = { request } as unknown as AuthenticatedHttpClient;
  const lead = leadDetailSchema.parse(testLead);
  const current = {
    lead,
    snapshot: createLeadSnapshot(
      `W/${currentStrongEtag}`,
      lead.id,
      lead.revision,
    ),
  };
  return { api: createLeadApi(http), current, request };
}

describe("createLeadApi mutations", () => {
  it.each([
    [201, false, "/api/v1/leads/00000000-0000-4000-8000-000000000010"],
    [200, true, undefined],
  ] as const)(
    "cria Lead identificado com status %s sem If-Match",
    async (status, replayed, location) => {
      const request = vi.fn().mockResolvedValue({
        data: testLeadView,
        status,
        etag: '"lead:created:1"',
        location,
        idempotencyReplayed: replayed,
      });
      const api = createLeadApi({ request } as AuthenticatedHttpClient);
      const idempotencyKey = createIdempotencyKey();
      const input = {
        displayName: "Lead Manual",
        primaryPhone: "(62) 99999-9999",
        source: "manual" as const,
        expectedValueMinor: "9007199254740993",
      };
      await expect(api.create(input, idempotencyKey)).resolves.toMatchObject({
        kind: "identified",
        status,
        replayed,
        etag: '"lead:created:1"',
      });
      expect(request).toHaveBeenCalledWith("/api/v1/leads", {
        kind: "idempotent-mutation",
        method: "POST",
        idempotencyKey,
        body: input,
      });
      expect(request.mock.calls[0]?.[1]).not.toHaveProperty("ifMatch");
    },
  );

  it("aceita o resultado opaco 204 sem tentar interpretar body ou ETag", async () => {
    const request = vi.fn().mockResolvedValue({
      data: undefined,
      status: 204,
      idempotencyReplayed: true,
    });
    const api = createLeadApi({ request } as AuthenticatedHttpClient);
    await expect(
      api.create(
        {
          displayName: "Lead Member",
          primaryPhone: "+12025550123",
          source: "manual",
        },
        createIdempotencyKey(),
      ),
    ).resolves.toEqual({ kind: "opaque", status: 204, replayed: true });
  });

  it("rejeita 201 sem Location e 204 com conteúdo como falha de protocolo", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: testLeadView,
        status: 201,
        etag: '"opaque"',
      })
      .mockResolvedValueOnce({ data: { id: testLead.id }, status: 204 });
    const api = createLeadApi({ request } as AuthenticatedHttpClient);
    const input = {
      displayName: "Lead",
      primaryPhone: "11999999999",
      source: "manual" as const,
    };
    await expect(
      api.create(input, createIdempotencyKey()),
    ).rejects.toMatchObject({ kind: "protocol" });
    await expect(
      api.create(input, createIdempotencyKey()),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("envia PATCH com ETag forte após receber o weak equivalente", async () => {
    const { api, current, request } = setup();
    await api.update(current, { displayName: "Nome atualizado" });
    expect(request).toHaveBeenLastCalledWith(`/api/v1/leads/${testLead.id}`, {
      kind: "conditional-mutation",
      method: "PATCH",
      ifMatch: currentStrongEtag,
      body: { displayName: "Nome atualizado" },
    });

    await api.assign(current, testMemberId);
    expect(request).toHaveBeenLastCalledWith(
      `/api/v1/leads/${testLead.id}/assignment`,
      {
        kind: "conditional-mutation",
        method: "PATCH",
        ifMatch: currentStrongEtag,
        body: { responsibleMembershipId: testMemberId },
      },
    );
  });

  it.each<{ intent: LeadIdempotentAction; suffix: string }>([
    {
      intent: {
        action: "activity",
        body: { type: "call", performedAt: "2026-07-28T12:00:00.000Z" },
      },
      suffix: "/activities",
    },
    {
      intent: { action: "note", body: { content: "Nota" } },
      suffix: "/notes",
    },
    {
      intent: {
        action: "next-action-create",
        body: {
          type: "follow_up",
          description: "Retornar",
          dueAt: "2026-07-29T12:00:00.000Z",
        },
      },
      suffix: "/next-action",
    },
    {
      intent: {
        action: "next-action-reschedule",
        body: { dueAt: "2026-07-30T12:00:00.000Z" },
      },
      suffix: "/next-action/reschedule",
    },
    {
      intent: {
        action: "next-action-complete",
        body: { performedAt: "2026-07-28T12:00:00.000Z" },
      },
      suffix: "/next-action/complete",
    },
    {
      intent: { action: "next-action-cancel", body: { note: "Cancelada" } },
      suffix: "/next-action/cancel",
    },
    {
      intent: { action: "move", body: { stage: "proposal" } },
      suffix: "/move",
    },
    { intent: { action: "win", body: {} }, suffix: "/win" },
    {
      intent: { action: "lose", body: { lostReason: "not_now" } },
      suffix: "/lose",
    },
    {
      intent: { action: "archive", body: { archiveReason: "outdated" } },
      suffix: "/archive",
    },
    {
      intent: { action: "reactivate", body: {} },
      suffix: "/reactivate",
    },
    {
      intent: { action: "dismiss-return", body: {} },
      suffix: "/return-review/dismiss",
    },
    {
      intent: {
        action: "expected-value",
        body: { expectedValueMinor: "9007199254740993" },
      },
      suffix: "/expected-value",
    },
    {
      intent: {
        action: "information",
        body: {
          displayName: "Lead Exemplo",
          primaryPhone: "+5511999999999",
          email: "lead@example.test",
          companyName: "Empresa Exemplo",
          instagram: null,
          city: "Campinas",
          serviceInterest: "Consultoria",
          expectedValueMinor: "9007199254740993",
        },
      },
      suffix: "/information",
    },
  ])(
    "maps $intent.action with combined concurrency headers",
    async ({ intent, suffix }) => {
      const { api, current, request } = setup();
      const idempotencyKey = createIdempotencyKey();
      await api.act(current, intent, idempotencyKey);
      expect(request).toHaveBeenCalledWith(
        `/api/v1/leads/${testLead.id}${suffix}`,
        {
          kind: "conditional-idempotent-mutation",
          method: "POST",
          ifMatch: currentStrongEtag,
          idempotencyKey,
          body: intent.body,
        },
      );
    },
  );
});

describe("createLeadApi Metrics", () => {
  it.each([
    [{ kind: "default" } as const, "/api/v1/leads/metrics/summary"],
    [
      {
        kind: "range",
        from: "2026-07-01" as never,
        to: "2026-07-29" as never,
      } as const,
      "/api/v1/leads/metrics/summary?from=2026-07-01&to=2026-07-29",
    ],
  ])("consulta o resumo tenant-scoped", async (period, path) => {
    const request = vi
      .fn()
      .mockResolvedValue({ data: testMetricsSummary, status: 200 });
    const signal = new AbortController().signal;
    const api = createLeadApi({ request } as AuthenticatedHttpClient);
    await expect(api.metrics(period, signal)).resolves.toEqual(
      testMetricsSummary,
    );
    expect(request).toHaveBeenCalledWith(path, {
      kind: "tenant-scoped",
      method: "GET",
      signal,
    });
  });

  it("rejeita resposta parcial como erro de protocolo", async () => {
    const api = createLeadApi({
      request: vi.fn().mockResolvedValue({
        data: { asOf: testMetricsSummary.asOf },
        status: 200,
      }),
    } as AuthenticatedHttpClient);
    await expect(api.metrics({ kind: "default" })).rejects.toMatchObject({
      kind: "protocol",
    });
  });
});

describe("createLeadApi Kanban", () => {
  const stages = [
    "new",
    "qualification",
    "diagnosis",
    "proposal",
    "negotiation",
  ] as const;
  const board = {
    asOf: "2026-07-28T16:00:00.000Z",
    currency: "BRL" as const,
    expectedValueTotalMinor: "2500000",
    withoutExpectedValue: 0,
    columns: stages.map((stage) => ({
      stage,
      total: stage === "qualification" ? 1 : 0,
      expectedValueTotalMinor: stage === "qualification" ? "2500000" : "0",
      withoutExpectedValue: 0,
      items: stage === "qualification" ? [testLeadListItem({ stage })] : [],
      page: { limit: 20, nextCursor: null },
    })),
  };

  it("usa a rota agregada e encaminha AbortSignal", async () => {
    const request = vi.fn().mockResolvedValue({ data: board, status: 200 });
    const api = createLeadApi({
      request,
    } as AuthenticatedHttpClient);
    const controller = new AbortController();
    await expect(
      api.kanban({ limit: 20, q: "Lead" }, {}, controller.signal),
    ).resolves.toEqual(board);
    expect(request).toHaveBeenCalledWith(
      "/api/v1/leads/kanban?limit=20&q=Lead",
      { kind: "tenant-scoped", method: "GET", signal: controller.signal },
    );
  });

  it("exige exatamente a coluna solicitada na continuação", async () => {
    const request = vi.fn().mockResolvedValue({ data: board, status: 200 });
    const api = createLeadApi({
      request,
    } as AuthenticatedHttpClient);
    await expect(
      api.kanban({ limit: 20 }, { stage: "proposal", cursor: "opaque" }),
    ).rejects.toMatchObject({ kind: "protocol" });
  });

  it("aceita o receipt opaco de um move 204", async () => {
    const { current } = setup();
    const request = vi.fn().mockResolvedValue({
      data: undefined,
      status: 204,
      etag: '"receipt-opaco"',
      idempotencyReplayed: true,
    });
    const api = createLeadApi({
      request,
    } as AuthenticatedHttpClient);
    await expect(
      api.act(
        current,
        { action: "move", body: { stage: "proposal" } },
        createIdempotencyKey(),
      ),
    ).resolves.toEqual({ etag: '"receipt-opaco"', replayed: true });
  });
});

describe("createLeadApi work queues", () => {
  const page = {
    nextCursor: "opaque-next",
    limit: 25,
    total: 1,
    asOf: "2026-07-29T12:00:00.000Z",
  };

  it("usa os três endpoints, encaminha AbortSignal e projeta PII", async () => {
    const raw = testLeadListItem();
    const request = vi.fn((path: string, options?: unknown) => {
      void options;
      return Promise.resolve({
        data: path.includes("return-reviews")
          ? {
              items: [
                {
                  lead: { ...raw, status: "won", returnPending: true },
                  review: {
                    id: "00000000-0000-4000-8000-000000000030",
                    cycleId: "00000000-0000-4000-8000-000000000031",
                    entryCount: "1",
                    openedAt: page.asOf,
                    updatedAt: page.asOf,
                    firstEntry: {
                      id: "00000000-0000-4000-8000-000000000032",
                      source: "manual",
                      receivedAt: page.asOf,
                    },
                    latestEntry: {
                      id: "00000000-0000-4000-8000-000000000032",
                      source: "manual",
                      receivedAt: page.asOf,
                    },
                  },
                },
              ],
              page,
            }
          : { items: [raw], page },
        status: 200,
      });
    });
    const api = createLeadApi({
      request,
    } as unknown as AuthenticatedHttpClient);
    const controller = new AbortController();
    const mine = await api.myActions(
      { state: "overdue", limit: 25 },
      undefined,
      controller.signal,
    );
    const unassigned = await api.unassigned(
      { status: "active", limit: 25 },
      "opaque",
      controller.signal,
    );
    const returns = await api.returnReviews(
      { limit: 25 },
      undefined,
      controller.signal,
    );
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/leads/work/my-actions?limit=25&state=overdue",
      "/api/v1/leads/work/unassigned?status=active&limit=25&cursor=opaque",
      "/api/v1/leads/work/return-reviews?limit=25",
    ]);
    for (const item of [
      mine.items[0],
      unassigned.items[0],
      returns.items[0]?.lead,
    ]) {
      expect(item).not.toHaveProperty("primaryPhone");
      expect(item).not.toHaveProperty("email");
    }
    expect(request.mock.calls[0]?.[1]).toEqual({
      kind: "tenant-scoped",
      method: "GET",
      signal: controller.signal,
    });
  });
});
