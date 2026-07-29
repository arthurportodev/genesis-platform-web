import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";
import { renderAppAt } from "@/test/renderApp";
import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
} from "@/test/msw/auth-handlers";
import {
  createLeadHandlers,
  testMetricsSummary,
} from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";

describe("Métricas Operacionais de Leads", () => {
  it("owner consulta o resumo oficial com tenant e vê as seções sem conversão inventada", async () => {
    const restoreLocks = installWebLocks();
    const requests: Array<{ url: URL; organization: string | null }> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onMetrics: (url, request) =>
          requests.push({
            url,
            organization: request.headers.get("x-organization-id"),
          }),
      }),
    );
    await renderAppAt("/app/metrics");

    expect(
      await screen.findByRole("heading", { name: "Métricas", level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Visão atual" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Desempenho do período" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Origem dos Leads" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Leads ativos" })).getByText(
        "42",
      ),
    ).toBeVisible();
    expect(screen.getByText(/America\/Belem/u)).toBeVisible();
    expect(screen.queryByText(/conversão/iu)).not.toBeInTheDocument();
    expect(requests[0]?.url.search).toBe("");
    expect(requests[0]?.organization).toBe(testOrganizations[0].id);
    restoreLocks();
  });

  it("member não vê navegação nem monta a query em acesso direto", async () => {
    const restoreLocks = installWebLocks();
    let metricsRequests = 0;
    server.use(
      ...createAuthHandlers({ organizations: [testOrganizations[1]] }),
      ...createLeadHandlers({
        organizationId: testOrganizations[1].id,
        onMetrics: () => (metricsRequests += 1),
      }),
    );
    await renderAppAt("/app/metrics");
    expect(
      await screen.findByRole("heading", { name: "Métricas", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText(/Somente owner ou admin/iu)).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Métricas" }),
    ).not.toBeInTheDocument();
    expect(metricsRequests).toBe(0);
    restoreLocks();
  });

  it("preserva range na URL e aplica presets e período personalizado", async () => {
    const restoreLocks = installWebLocks();
    const requested: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onMetrics: (url) => requested.push(url) }),
    );
    const user = userEvent.setup();
    const { router } = await renderAppAt(
      "/app/metrics?from=2026-07-01&to=2026-07-29",
    );
    await screen.findByText("42");
    expect(requested[0]?.searchParams.get("from")).toBe("2026-07-01");
    expect(requested[0]?.searchParams.get("to")).toBe("2026-07-29");

    await user.selectOptions(
      screen.getByLabelText("Seleção de período"),
      "last7",
    );
    await waitFor(() =>
      expect(requested.at(-1)?.searchParams.get("from")).toBe("2026-07-23"),
    );
    expect(router.state.location.search.from).toBe("2026-07-23");

    await user.selectOptions(
      screen.getByLabelText("Seleção de período"),
      "custom",
    );
    await user.clear(screen.getByLabelText("De"));
    await user.type(screen.getByLabelText("De"), "2026-08-10");
    await user.clear(screen.getByLabelText("Até"));
    await user.type(screen.getByLabelText("Até"), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Aplicar período" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        from: "2026-08-10",
        to: "2026-08-10",
      }),
    );
    restoreLocks();
  });

  it("canonicaliza URL inválida para o default sem enviar parâmetros", async () => {
    const restoreLocks = installWebLocks();
    const requested: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onMetrics: (url) => requested.push(url) }),
    );
    const { router } = await renderAppAt("/app/metrics?from=2026-07-01");
    expect(
      await screen.findByText(/Informe as datas inicial e final/iu),
    ).toBeVisible();
    await screen.findByText("42");
    expect(requested[0]?.search).toBe("");
    await waitFor(() =>
      expect(router.state.location.search.from).toBeUndefined(),
    );
    restoreLocks();
  });

  it("avisa e remove parâmetros desconhecidos ou não textuais", async () => {
    const restoreLocks = installWebLocks();
    const requested: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onMetrics: (url) => requested.push(url) }),
    );
    const { router } = await renderAppAt("/app/metrics?foo=bar");
    expect(
      await screen.findByText(/Parâmetros de período desconhecidos/iu),
    ).toBeVisible();
    await screen.findByText("42");
    expect(requested[0]?.search).toBe("");
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    restoreLocks();
  });

  it("renderiza zeros e source futura como dados válidos", async () => {
    const restoreLocks = installWebLocks();
    const futureSource = {
      ...testMetricsSummary,
      snapshot: {
        active: 0,
        unassigned: 0,
        overdue: 0,
        withoutNextAction: 0,
        pendingReturns: 0,
      },
      period: {
        ...testMetricsSummary.period,
        created: 2,
        won: 0,
        lost: 0,
        createdBySource: [{ source: "partner_referral", count: 2 }],
      },
    };
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ metricsResponse: futureSource }),
    );
    await renderAppAt("/app/metrics");
    expect(await screen.findByText("Origem não catalogada")).toBeVisible();
    expect(screen.getByText("(partner_referral)")).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Leads ativos" })).getByText(
        "0",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: /Taxa de ganho/iu })).getByText(
        "—",
      ),
    ).toBeVisible();
    restoreLocks();
  });

  it.each([
    [400, /Período não aceito/iu],
    [429, /cooldown/iu],
    [503, /não está pronta para uma leitura confiável/iu],
    [404, /rota esperada da API/iu],
    [500, /Não foi possível carregar as métricas/iu],
  ])("trata HTTP %s sem transformar em vazio", async (status, message) => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ metricsStatus: status }),
    );
    await renderAppAt("/app/metrics");
    expect(
      await screen.findByText(message, {}, { timeout: 5_000 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Leads ativos" }),
    ).not.toBeInTheDocument();
    restoreLocks();
  });

  it("trata 401 pelo fluxo de sessão sem mostrar métricas", async () => {
    const restoreLocks = installWebLocks();
    let metricsRequests = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        metricsStatus: 401,
        onMetrics: () => (metricsRequests += 1),
      }),
    );
    const { queryClient } = await renderAppAt("/app/metrics");
    await waitFor(() => expect(metricsRequests).toBe(2));
    await waitFor(() =>
      expect(
        queryClient
          .getQueriesData({
            queryKey: leadQueryKeys.metricsRoot(testOrganizations[0].id),
          })
          .every(([, data]) => data === undefined),
      ).toBe(true),
    );
    expect(
      screen.queryByRole("group", { name: "Leads ativos" }),
    ).not.toBeInTheDocument();
    restoreLocks();
  });

  it("remove cache e dados quando o backend revoga o acesso", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ metricsStatus: 403 }),
    );
    const { queryClient } = await renderAppAt("/app/metrics");
    await waitFor(() =>
      expect(screen.getByText(/Somente owner ou admin/iu)).toBeVisible(),
    );
    await waitFor(() =>
      expect(
        queryClient.getQueriesData({
          queryKey: leadQueryKeys.metricsRoot(testOrganizations[0].id),
        }),
      ).toEqual([]),
    );
    restoreLocks();
  });

  it("remove dados carregados em 403 mesmo quando o rebootstrap falha", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    const user = userEvent.setup();
    const { queryClient } = await renderAppAt("/app/metrics");
    await screen.findByText("42");
    server.use(
      http.get("/api/v1/leads/metrics/summary", () =>
        HttpResponse.json(
          { statusCode: 403, message: "Forbidden" },
          { status: 403 },
        ),
      ),
      http.get("/api/v1/auth/bootstrap", () =>
        HttpResponse.json(
          { statusCode: 503, message: "Bootstrap unavailable" },
          { status: 503 },
        ),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() =>
      expect(screen.getByText(/Somente owner ou admin/iu)).toBeVisible(),
    );
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        queryClient.getQueriesData({
          queryKey: leadQueryKeys.metricsRoot(testOrganizations[0].id),
        }),
      ).toEqual([]),
    );
    restoreLocks();
  });

  it("preserva dados anteriores quando o refresh falha", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ metricsRefreshStatus: 503 }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/metrics");
    await screen.findByText("42");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(
      await screen.findByText(
        /dados anteriores permanecem visíveis/iu,
        {},
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(screen.getByText("42")).toBeVisible();
    restoreLocks();
  });

  it("remove o cache autenticado no logout após carregar Metrics", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    const user = userEvent.setup();
    const { queryClient } = await renderAppAt("/app/metrics");
    await screen.findByText("42");
    await user.click(
      screen.getByRole("button", { name: "Abrir menu do usuário" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Sair" }));
    await screen.findByRole("heading", { name: "Acesse sua conta" });
    expect(
      queryClient.getQueriesData({
        queryKey: leadQueryKeys.metricsRoot(testOrganizations[0].id),
      }),
    ).toEqual([]);
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    restoreLocks();
  });

  it("rejeita resposta inconsistente sem renderizar valores parciais", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        metricsResponse: {
          ...testMetricsSummary,
          period: { ...testMetricsSummary.period, created: 999 },
        },
      }),
    );
    await renderAppAt("/app/metrics");
    expect(
      await screen.findByText(/Nenhum dado parcial foi exibido/iu),
    ).toBeVisible();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    restoreLocks();
  });
});
