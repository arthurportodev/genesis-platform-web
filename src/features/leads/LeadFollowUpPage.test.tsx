import { HttpResponse, http } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
} from "@/test/msw/auth-handlers";
import {
  testLead,
  testLeadId,
  testLeadListItem,
  testMemberId,
} from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";
import { renderAppAt } from "@/test/renderApp";

const actionId = "00000000-0000-4000-8000-000000000020";
const unassignedId = "00000000-0000-4000-8000-000000000021";
const returnId = "00000000-0000-4000-8000-000000000022";
const reviewId = "00000000-0000-4000-8000-000000000023";

const nextAction = {
  id: actionId,
  type: "call" as const,
  description: "Retornar contato comercial",
  dueAt: "2026-07-29T12:00:00.000Z",
  responsibleMembershipId: testOrganizations[0].membershipId,
  status: "pending" as const,
  revision: "2",
};

function detail(id: string, kind: "action" | "unassigned" | "return") {
  const closed = kind === "return";
  return {
    ...testLead,
    id,
    displayName:
      kind === "action"
        ? "Lead Prioritário"
        : kind === "unassigned"
          ? "Lead Sem Responsável"
          : "Lead com Retorno",
    responsibleMembershipId:
      kind === "unassigned" ? null : testOrganizations[0].membershipId,
    status: closed ? "won" : "active",
    returnReviewPending: closed,
    nextAction: kind === "action" ? nextAction : null,
    latestCycle: {
      ...testLead.latestCycle,
      closedByMembershipId: closed ? testOrganizations[0].membershipId : null,
      closedAt: closed ? "2026-07-28T15:00:00.000Z" : null,
      closingStatus: closed ? "won" : null,
      stageAtClose: closed ? testLead.stage : null,
    },
    pendingReturn: closed
      ? {
          id: reviewId,
          cycleId: testLead.latestCycle.id,
          entryCount: "2",
          openedAt: "2026-07-29T09:00:00.000Z",
          updatedAt: "2026-07-29T10:00:00.000Z",
        }
      : null,
  };
}

function queuePage(items: unknown[], nextCursor: string | null = null) {
  return {
    items,
    page: {
      nextCursor,
      limit: 25,
      total: items.length,
      asOf: "2026-07-29T12:00:00.000Z",
    },
  };
}

function workHandlers(
  options: {
    requests?: string[];
    mutationKeys?: Array<string | null>;
    completeNetworkFailures?: number;
    assignmentNetworkFailures?: number;
    detailRequests?: string[];
    completeStatus?: number;
    myActionsRefreshStatus?: number;
    paginateMyActions?: boolean;
    continuationStatus?: number;
    unassignedRefreshStatus?: number;
    actionRequests?: Array<{
      path: string;
      key: string | null;
      body: unknown;
    }>;
  } = {},
) {
  let complete = false;
  let assigned = false;
  let dismissed = false;
  let failures = options.completeNetworkFailures ?? 0;
  let assignmentFailures = options.assignmentNetworkFailures ?? 0;
  let myActionsReads = 0;
  let unassignedReads = 0;
  const myItem = testLeadListItem({
    displayName: "Lead Prioritário",
    nextAction,
    temporalState: "overdue",
  });
  const unassigned = testLeadListItem({
    id: unassignedId,
    displayName: "Lead Sem Responsável",
    responsibleMembershipId: null,
    nextAction: null,
    temporalState: "none",
  });
  const returned = testLeadListItem({
    id: returnId,
    displayName: "Lead com Retorno",
    status: "won",
    returnPending: true,
    nextAction: null,
    temporalState: "none",
  });
  return [
    http.get("/api/v1/leads/work/my-actions", ({ request }) => {
      myActionsReads += 1;
      options.requests?.push(new URL(request.url).pathname);
      const cursor = new URL(request.url).searchParams.get("cursor");
      if (cursor && options.continuationStatus) {
        return HttpResponse.json(
          { statusCode: options.continuationStatus, message: "Unavailable" },
          { status: options.continuationStatus },
        );
      }
      if (myActionsReads > 1 && !cursor && options.myActionsRefreshStatus) {
        return HttpResponse.json(
          {
            statusCode: options.myActionsRefreshStatus,
            message: "Unavailable",
          },
          { status: options.myActionsRefreshStatus },
        );
      }
      if (options.paginateMyActions) {
        const second = testLeadListItem({
          id: "00000000-0000-4000-8000-000000000026",
          displayName: "Segundo Lead",
          nextAction: {
            ...nextAction,
            id: "00000000-0000-4000-8000-000000000027",
          },
          temporalState: "overdue",
        });
        return HttpResponse.json({
          ...queuePage(cursor ? [second] : [myItem], cursor ? null : "opaque"),
          page: {
            ...queuePage([], cursor ? null : "opaque").page,
            total: 2,
          },
        });
      }
      return HttpResponse.json(queuePage(complete ? [] : [myItem]));
    }),
    http.get("/api/v1/leads/work/unassigned", ({ request }) => {
      unassignedReads += 1;
      options.requests?.push(new URL(request.url).pathname);
      if (unassignedReads > 1 && options.unassignedRefreshStatus) {
        return HttpResponse.json(
          {
            statusCode: options.unassignedRefreshStatus,
            message: "Unavailable",
          },
          { status: options.unassignedRefreshStatus },
        );
      }
      return HttpResponse.json(queuePage(assigned ? [] : [unassigned]));
    }),
    http.get("/api/v1/leads/work/return-reviews", ({ request }) => {
      options.requests?.push(new URL(request.url).pathname);
      return HttpResponse.json(
        queuePage(
          dismissed
            ? []
            : [
                {
                  lead: returned,
                  review: {
                    id: reviewId,
                    cycleId: testLead.latestCycle.id,
                    entryCount: "2",
                    openedAt: "2026-07-29T09:00:00.000Z",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                    firstEntry: {
                      id: "00000000-0000-4000-8000-000000000024",
                      source: "manual",
                      receivedAt: "2026-07-29T09:00:00.000Z",
                    },
                    latestEntry: {
                      id: "00000000-0000-4000-8000-000000000025",
                      source: "manual",
                      receivedAt: "2026-07-29T10:00:00.000Z",
                    },
                  },
                },
              ],
        ),
      );
    }),
    http.get("/api/v1/members", () =>
      HttpResponse.json({
        items: [
          {
            id: testMemberId,
            name: "Pessoa Responsável",
            email: "responsavel@example.test",
            role: "member",
            status: "active",
            createdAt: "2026-07-20T12:00:00.000Z",
            updatedAt: "2026-07-20T12:00:00.000Z",
          },
        ],
        page: { nextCursor: null, limit: 100 },
      }),
    ),
    ...[
      [testLeadId, "action"],
      [unassignedId, "unassigned"],
      [returnId, "return"],
    ].map(([id, kind]) =>
      http.get(`/api/v1/leads/${id}`, () => {
        options.detailRequests?.push(id);
        return HttpResponse.json(
          detail(id, kind as "action" | "unassigned" | "return"),
          {
            headers: { ETag: `"opaque:${id}:3"` },
          },
        );
      }),
    ),
    http.post(
      `/api/v1/leads/${testLeadId}/next-action/complete`,
      ({ request }) => {
        options.mutationKeys?.push(request.headers.get("idempotency-key"));
        if (failures > 0) {
          failures -= 1;
          return HttpResponse.error();
        }
        expect(request.headers.get("if-match")).toBe(
          `"opaque:${testLeadId}:3"`,
        );
        if (options.completeStatus === 429) {
          return HttpResponse.json(
            { statusCode: 429, message: "Rate limit", error: "Too Many" },
            { status: 429 },
          );
        }
        if (options.completeStatus) {
          return HttpResponse.json(
            {
              statusCode: options.completeStatus,
              message: "Mutation rejected",
            },
            { status: options.completeStatus },
          );
        }
        complete = true;
        return new HttpResponse(null, {
          status: 204,
          headers: { ETag: `"opaque:${testLeadId}:4"` },
        });
      },
    ),
    ...["reschedule", "cancel"].map((action) =>
      http.post(
        `/api/v1/leads/${testLeadId}/next-action/${action}`,
        async ({ request }) => {
          options.actionRequests?.push({
            path: new URL(request.url).pathname,
            key: request.headers.get("idempotency-key"),
            body: await request.json(),
          });
          expect(request.headers.get("if-match")).toBe(
            `"opaque:${testLeadId}:3"`,
          );
          return new HttpResponse(null, {
            status: 204,
            headers: { ETag: `"opaque:${testLeadId}:4"` },
          });
        },
      ),
    ),
    http.patch(`/api/v1/leads/${unassignedId}/assignment`, ({ request }) => {
      expect(request.headers.get("idempotency-key")).toBeNull();
      expect(request.headers.get("if-match")).toBe(
        `"opaque:${unassignedId}:3"`,
      );
      if (assignmentFailures > 0) {
        assignmentFailures -= 1;
        return HttpResponse.error();
      }
      assigned = true;
      return HttpResponse.json(detail(unassignedId, "unassigned"), {
        headers: { ETag: `"opaque:${unassignedId}:4"` },
      });
    }),
    http.post(
      `/api/v1/leads/${returnId}/return-review/dismiss`,
      ({ request }) => {
        expect(request.headers.has("idempotency-key")).toBe(true);
        expect(request.headers.get("if-match")).toBe(`"opaque:${returnId}:3"`);
        dismissed = true;
        return new HttpResponse(null, {
          status: 204,
          headers: { ETag: `"opaque:${returnId}:4"` },
        });
      },
    ),
  ];
}

describe("Follow-up e filas operacionais", () => {
  it("aplica tabs por papel, lazy loading e projeção sem PII", async () => {
    const restoreLocks = installWebLocks();
    const requests: string[] = [];
    server.use(...createAuthHandlers(), ...workHandlers({ requests }));
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");

    expect(
      await screen.findByRole("heading", { name: "Follow-up" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Minhas ações" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Atrasadas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Lead Prioritário")).toBeVisible();
    expect(screen.queryByText(testLead.primaryPhone)).not.toBeInTheDocument();
    expect(screen.queryByText(testLead.email)).not.toBeInTheDocument();
    expect(requests).toEqual(["/api/v1/leads/work/my-actions"]);

    const overdue = screen.getByRole("tab", { name: "Atrasadas" });
    overdue.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Hoje" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const myActions = screen.getByRole("tab", { name: "Minhas ações" });
    myActions.focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Lead Sem Responsável")).toBeVisible();
    expect(requests).toContain("/api/v1/leads/work/unassigned");
    expect(requests).not.toContain("/api/v1/leads/work/return-reviews");
    restoreLocks();
  });

  it("não mostra filas administrativas para member", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers({ organizations: [testOrganizations[1]] }),
      ...workHandlers(),
    );
    await renderAppAt("/app/follow-up");
    expect(await screen.findByText("Lead Prioritário")).toBeVisible();
    expect(
      screen.queryByRole("tab", { name: "Sem responsável" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Retornos para revisão" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ações de")).not.toBeInTheDocument();
    restoreLocks();
  });

  it("faz preflight, conclui server-confirmed e move foco quando o item sai", async () => {
    const restoreLocks = installWebLocks();
    const keys: Array<string | null> = [];
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ mutationKeys: keys }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await screen.findByText("Lead Prioritário");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Concluir próxima ação" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Concluir próxima ação",
    });
    await user.type(
      within(dialog).getByLabelText("Resultado opcional"),
      "Concluída",
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Próxima ação atualizada e fila reorganizada."),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText("Lead Prioritário")).not.toBeInTheDocument(),
    );
    expect(keys).toHaveLength(1);
    expect(document.activeElement).toHaveAttribute("data-lead-work-heading");
    restoreLocks();
  });

  it("preserva a mesma chave em resultado remoto incerto e retry", async () => {
    const restoreLocks = installWebLocks();
    const keys: Array<string | null> = [];
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ mutationKeys: keys, completeNetworkFailures: 1 }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await screen.findByText("Lead Prioritário");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Concluir próxima ação" }),
    );
    await user.dblClick(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(/resultado remoto não foi confirmado/iu),
    ).toBeVisible();
    expect(keys).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("Próxima ação atualizada e fila reorganizada."),
    ).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    restoreLocks();
  });

  it("atribui sem Idempotency-Key e dispensa somente Lead encerrado", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...workHandlers());
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");

    await user.click(screen.getByRole("tab", { name: "Sem responsável" }));
    await screen.findByText("Lead Sem Responsável");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Atribuir responsável" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Responsável ativo"),
      testMemberId,
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Lead atribuído e fila atualizada."),
    ).toBeVisible();

    await user.click(
      screen.getByRole("tab", { name: "Retornos para revisão" }),
    );
    await screen.findByText("Lead com Retorno");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead com Retorno/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Dispensar retorno" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Retorno dispensado e removido da fila."),
    ).toBeVisible();
    restoreLocks();
  });

  it("bloqueia assignment incerto até GET de verificação, sem replay ou abandono", async () => {
    const restoreLocks = installWebLocks();
    const detailRequests: string[] = [];
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ assignmentNetworkFailures: 1, detailRequests }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await user.click(screen.getByRole("tab", { name: "Sem responsável" }));
    await screen.findByText("Lead Sem Responsável");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Atribuir responsável" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Responsável ativo"),
      testMemberId,
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(/resultado da atribuição não foi confirmado/iu),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abandonar tentativa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    ).toBeDisabled();

    const beforeVerify = detailRequests.length;
    await user.click(screen.getByRole("button", { name: "Verificar estado" }));
    await screen.findByText(/Estado atualizado/iu);
    expect(detailRequests.length).toBeGreaterThan(beforeVerify);
    expect(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    ).toBeEnabled();
    restoreLocks();
  });

  it("mantém assignment bloqueado se a fila falhar durante a verificação", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({
        assignmentNetworkFailures: 1,
        unassignedRefreshStatus: 503,
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await user.click(screen.getByRole("tab", { name: "Sem responsável" }));
    await screen.findByText("Lead Sem Responsável");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Atribuir responsável" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Responsável ativo"),
      testMemberId,
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText(/resultado da atribuição não foi confirmado/iu);
    await user.click(screen.getByRole("button", { name: "Verificar estado" }));
    expect(
      await screen.findByText(/operação permanece bloqueada/iu, undefined, {
        timeout: 5_000,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Sem Responsável/iu,
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Abandonar tentativa" }),
    ).not.toBeInTheDocument();
    restoreLocks();
  });

  it("aplica cooldown local após 429 e bloqueia novas intenções", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ completeStatus: 429 }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await screen.findByText("Lead Prioritário");
    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Concluir próxima ação" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/cooldown local/iu)).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Fechar aviso" }),
    ).not.toBeInTheDocument();
    restoreLocks();
  });

  it("reagenda e cancela com ETag e chaves contextuais distintas", async () => {
    const restoreLocks = installWebLocks();
    const actionRequests: Array<{
      path: string;
      key: string | null;
      body: unknown;
    }> = [];
    server.use(...createAuthHandlers(), ...workHandlers({ actionRequests }));
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    await screen.findByText("Lead Prioritário");

    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Reagendar próxima ação" }),
    );
    const dueAt = screen.getByLabelText("Nova data e hora");
    await user.clear(dueAt);
    await user.type(dueAt, "2026-07-30T14:30");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText(/fila reorganizada/iu);

    await user.click(
      screen.getByRole("button", {
        name: /Ações rápidas de Lead Prioritário/iu,
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Cancelar próxima ação" }),
    );
    await user.type(screen.getByLabelText("Motivo opcional"), "Sem retorno");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(actionRequests).toHaveLength(2));
    expect(actionRequests.map(({ path }) => path)).toEqual([
      `/api/v1/leads/${testLeadId}/next-action/reschedule`,
      `/api/v1/leads/${testLeadId}/next-action/cancel`,
    ]);
    expect(actionRequests[0]?.key).toBeTruthy();
    expect(actionRequests[1]?.key).toBeTruthy();
    expect(actionRequests[1]?.key).not.toBe(actionRequests[0]?.key);
    restoreLocks();
  });

  it("pagina por cursor e preserva a primeira página em erro de continuação", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ paginateMyActions: true, continuationStatus: 503 }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    expect(await screen.findByText("Lead Prioritário")).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("1 carregados de 2") === true,
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(
      await screen.findByText(
        /não foi possível carregar mais itens/iu,
        undefined,
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(screen.getByText("Lead Prioritário")).toBeVisible();
    restoreLocks();
  });

  it("mantém itens e anuncia 503 em refresh", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...workHandlers({ myActionsRefreshStatus: 503 }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/follow-up");
    expect(await screen.findByText("Lead Prioritário")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(
      await screen.findByText(
        /itens carregados foram preservados/iu,
        undefined,
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(screen.getByText("Lead Prioritário")).toBeVisible();
    restoreLocks();
  });

  it.each([409, 412, 428])(
    "refaz detalhe e fila após conflito HTTP %s, sem retry automático",
    async (status) => {
      const restoreLocks = installWebLocks();
      const keys: Array<string | null> = [];
      const detailRequests: string[] = [];
      server.use(
        ...createAuthHandlers(),
        ...workHandlers({
          completeStatus: status,
          mutationKeys: keys,
          detailRequests,
        }),
      );
      const user = userEvent.setup();
      await renderAppAt("/app/follow-up");
      await screen.findByText("Lead Prioritário");
      await user.click(
        screen.getByRole("button", {
          name: /Ações rápidas de Lead Prioritário/iu,
        }),
      );
      await user.click(
        screen.getByRole("menuitem", { name: "Concluir próxima ação" }),
      );
      await user.click(screen.getByRole("button", { name: "Confirmar" }));
      await screen.findByRole("alert");
      expect(keys).toHaveLength(1);
      expect(detailRequests.length).toBeGreaterThanOrEqual(2);
      expect(
        screen.queryByRole("button", { name: "Tentar novamente" }),
      ).not.toBeInTheDocument();
      restoreLocks();
    },
  );
});
