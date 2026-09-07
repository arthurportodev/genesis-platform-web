import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
} from "@/test/msw/auth-handlers";
import {
  createLeadHandlers,
  testLeadId,
  testPipelineId,
  testPipelines,
  testPipelineStageIds,
} from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";

async function openMove(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    (
      await screen.findAllByRole("button", {
        name: /Ações de Lead Exemplo/iu,
      })
    )[0],
  );
  expect(
    await screen.findByRole("menuitem", { name: "Abrir detalhe" }),
  ).toBeVisible();
  const moveTo = await screen.findByRole("menuitem", { name: "Mover para" });
  act(() => moveTo.focus());
  await user.keyboard("{ArrowRight}");
  const destination = await screen.findByRole("menuitem", {
    name: /Proposta/iu,
  });
  act(() => destination.focus());
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("dialog", {
    name: /Confirmar mudança de etapa/iu,
  });
  return dialog;
}

describe("Pipeline Kanban de Leads", () => {
  it("carrega cinco colunas, totais e card sem PII", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    await renderAppAt("/app/pipeline");

    expect(
      await screen.findByRole("heading", { name: "Pipeline" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Nova oportunidade" }),
    ).toHaveAttribute(
      "href",
      `/app/leads/new?from=pipeline&pipelineId=${testPipelineId}`,
    );
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeVisible();
    expect((await screen.findAllByText("Lead Exemplo"))[0]).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(screen.queryByText("+5511999999999")).not.toBeInTheDocument();
    expect(screen.queryByText("lead@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText(testLeadId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Pipeline de Leads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Resumo do Pipeline" }),
    ).toHaveTextContent(/Oportunidades\s*1/u);
    expect(
      screen.getByRole("region", { name: "Resumo do Pipeline" }),
    ).toHaveTextContent(/Valor esperado\s*R\$ 25\.000,00/u);
    expect(screen.getAllByText("R$ 25.000,00")).not.toHaveLength(0);
    expect(
      screen.getAllByText("Nenhuma oportunidade nesta etapa"),
    ).not.toHaveLength(0);
    expect(screen.queryByText(/carregados/iu)).not.toBeInTheDocument();
    restoreLocks();
  });

  it.each([
    [null, "Valor não informado"],
    ["0", "R$ 0,00"],
  ] as const)("preserva expected value %s no DOM", async (value, label) => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        kanbanItemOverrides: { expectedValueMinor: value },
      }),
    );
    await renderAppAt("/app/pipeline");

    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
    if (value === null) {
      expect(
        within(
          screen.getAllByRole("article", { name: "Lead Exemplo" })[0],
        ).queryByText("R$ 0,00"),
      ).not.toBeInTheDocument();
    }
    restoreLocks();
  });

  it("destaca a próxima ação e nomeia sua ausência honestamente", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        kanbanItemOverrides: {
          temporalState: "today",
          nextAction: {
            id: "00000000-0000-4000-8000-000000000099",
            type: "call",
            description: "Confirmar proposta",
            dueAt: "2026-07-28T18:00:00.000Z",
            responsibleMembershipId: null,
            status: "pending",
            revision: "1",
          },
        },
      }),
    );
    await renderAppAt("/app/pipeline");

    expect((await screen.findAllByText("Próxima ação")).length).toBeGreaterThan(
      0,
    );
    expect(
      (await screen.findAllByText(/call · Hoje/iu)).length,
    ).toBeGreaterThan(0);
    restoreLocks();
  });

  it("mantém Lead sem canMove fora do drag e preserva acesso ao detalhe", async () => {
    const restoreLocks = installWebLocks();
    const memberOrganization = {
      ...testOrganizations[0],
      membershipId: testOrganizations[1].membershipId,
      role: "member" as const,
    };
    server.use(
      ...createAuthHandlers({ organizations: [memberOrganization] }),
      ...createLeadHandlers(),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");

    await screen.findAllByText("Lead Exemplo");
    expect(document.querySelector('[data-draggable="true"]')).toBeNull();
    await user.click(
      (
        await screen.findAllByRole("button", {
          name: /Ações de Lead Exemplo/iu,
        })
      )[0],
    );
    expect(
      await screen.findByRole("menuitem", { name: "Abrir detalhe" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Mover para" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Configurar Pipelines")).not.toBeInTheDocument();
    restoreLocks();
  });

  it("troca o Pipeline pela URL e recarrega somente o quadro selecionado", async () => {
    const restoreLocks = installWebLocks();
    const requests: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onKanban: (url) => requests.push(url) }),
    );
    const user = userEvent.setup();
    const app = await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");
    await user.selectOptions(
      screen.getByLabelText("Pipeline atual"),
      testPipelines[1].id,
    );
    await waitFor(() =>
      expect(app.router.state.location.search.pipelineId).toBe(
        testPipelines[1].id,
      ),
    );
    expect(
      (await screen.findAllByRole("heading", { name: "Recebido" }))[0],
    ).toBeVisible();
    expect(screen.queryByText("Lead Exemplo")).not.toBeInTheDocument();
    expect(requests.at(-1)?.pathname).toBe(
      `/api/v1/pipelines/${testPipelines[1].id}/kanban`,
    );
    restoreLocks();
  });

  it.each([
    "/app/pipeline?pipelineId=valor-invalido",
    "/app/pipeline?pipelineId=00000000-0000-4000-8000-000000000199",
  ])("faz fallback seguro para o Pipeline padrão em %s", async (path) => {
    const restoreLocks = installWebLocks();
    const requests: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onKanban: (url) => requests.push(url) }),
    );
    await renderAppAt(path);

    expect(await screen.findByLabelText("Pipeline atual")).toHaveValue(
      testPipelineId,
    );
    expect(requests.at(-1)?.pathname).toBe(
      `/api/v1/pipelines/${testPipelineId}/kanban`,
    );
    restoreLocks();
  });

  it("isola falha de continuação e permite retry local", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        kanbanNextCursor: "opaque-column-cursor",
        kanbanContinuationStatus: 503,
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");
    expect(screen.getAllByText("1 de 1 carregados")).not.toHaveLength(0);
    await user.click(
      screen.getAllByRole("button", {
        name: "Carregar mais",
      })[0],
    );
    expect(
      await screen.findAllByText(
        /carregar mais Leads desta etapa/iu,
        {},
        { timeout: 5_000 },
      ),
    ).not.toHaveLength(0);
    expect(screen.getAllByText("Lead Exemplo")).not.toHaveLength(0);
    restoreLocks();
  });

  it("faz preflight do ETag opaco, mantém card na origem e confirma move 204", async () => {
    const restoreLocks = installWebLocks();
    const calls: Array<{ ifMatch: string | null; key: string | null }> = [];
    let details = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        moveDelayMs: 500,
        onDetail: () => (details += 1),
        onMutation: (request) =>
          calls.push({
            ifMatch: request.headers.get("x-genesis-if-match"),
            key: request.headers.get("idempotency-key"),
          }),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    const dialog = await openMove(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirmar movimento" }),
    );
    expect(await screen.findByText("Movendo Lead")).toBeVisible();
    expect(document.querySelector('[data-draggable="true"]')).toBeNull();
    expect(screen.getAllByText("Lead Exemplo")[0]).toBeVisible();
    expect(await screen.findByText("Lead movido com sucesso.")).toBeVisible();
    expect(details).toBe(1);
    expect(calls[0]?.ifMatch).toBe(`"lead:${testLeadId}:3"`);
    expect(typeof calls[0]?.key).toBe("string");
    expect(document.activeElement).toHaveAttribute(
      "data-pipeline-column-heading",
      testPipelineStageIds[3],
    );
    restoreLocks();
  });

  it("descarta continuação stale após movimento e releitura autoritativa", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ kanbanNextCursor: "opaque-column-cursor" }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");

    await user.click(
      screen.getAllByRole("button", { name: "Carregar mais" })[0],
    );
    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: "Carregar mais" }),
      ).toHaveLength(0),
    );
    const dialog = await openMove(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirmar movimento" }),
    );
    expect(await screen.findByText("Lead movido com sucesso.")).toBeVisible();

    const source = document.querySelector(
      `[aria-labelledby="pipeline-column-desktop-${testPipelineStageIds[1]}"]`,
    );
    const destination = document.querySelector(
      `[aria-labelledby="pipeline-column-desktop-${testPipelineStageIds[3]}"]`,
    );
    expect(source).not.toHaveTextContent("Lead Exemplo");
    expect(destination).toHaveTextContent("Lead Exemplo");
    restoreLocks();
  });

  it("preserva a mesma chave no resultado incerto e no retry manual", async () => {
    const restoreLocks = installWebLocks();
    const keys: Array<string | null> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        moveNetworkFailures: 1,
        onMutation: (request) =>
          keys.push(request.headers.get("idempotency-key")),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    const dialog = await openMove(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirmar movimento" }),
    );
    expect(
      await screen.findByText(
        /não foi possível confirmar o resultado remoto/iu,
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Lead movido com sucesso.")).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    restoreLocks();
  });

  it("preserva a intenção incerta ao navegar e voltar ao Pipeline", async () => {
    const restoreLocks = installWebLocks();
    const keys: Array<string | null> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        moveNetworkFailures: 1,
        onMutation: (request) =>
          keys.push(request.headers.get("idempotency-key")),
      }),
    );
    const user = userEvent.setup();
    const { router } = await renderAppAt("/app/pipeline");
    const dialog = await openMove(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirmar movimento" }),
    );
    expect(
      await screen.findByText(
        /não foi possível confirmar o resultado remoto/iu,
        {},
        { timeout: 5_000 },
      ),
    ).toBeVisible();

    await act(() => router.navigate({ to: "/app" }));
    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    await act(() => router.navigate({ to: "/app/pipeline" }));
    expect(
      await screen.findByText(
        /não foi possível confirmar o resultado remoto/iu,
        {},
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Lead movido com sucesso.")).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    restoreLocks();
  });

  it.each([
    [409, /estágio ou o estado deste Lead mudou/iu],
    [412, /atualizado por outra operação/iu],
  ])("não repete automaticamente conflito %s", async (status, message) => {
    const restoreLocks = installWebLocks();
    let calls = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        mutationStatus: status,
        onMutation: () => (calls += 1),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    const dialog = await openMove(user);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirmar movimento" }),
    );
    expect(await screen.findByText(message)).toBeVisible();
    expect(calls).toBe(1);
    expect(document.activeElement).toHaveAccessibleName(
      /Ações de Lead Exemplo/iu,
    );
    restoreLocks();
  });

  it("envia a configuração com revisão do Pipeline e exibe sucesso", async () => {
    const restoreLocks = installWebLocks();
    const calls: Array<{ request: Request; body: unknown }> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onPipelineMutation: (request, body) => calls.push({ request, body }),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");

    await user.click(screen.getByText("Configurar Pipelines"));
    const name = screen.getByLabelText("Nome do Pipeline atual");
    await user.clear(name);
    await user.type(name, "Pipeline principal");
    await user.click(screen.getByRole("button", { name: "Renomear" }));

    expect(await screen.findByText("Configuração salva.")).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.request.method).toBe("PATCH");
    expect(new URL(calls[0]?.request.url ?? "").pathname).toBe(
      `/api/v1/pipelines/${testPipelineId}`,
    );
    expect(calls[0]?.request.headers.get("x-genesis-if-match")).toBe(
      `"pipeline:${testPipelineId}:1"`,
    );
    expect(calls[0]?.body).toEqual({ name: "Pipeline principal" });
    restoreLocks();
  });

  it("explica conflito de configuração sem repetir a operação", async () => {
    const restoreLocks = installWebLocks();
    let calls = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        pipelineMutationStatus: 409,
        onPipelineMutation: () => (calls += 1),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");

    await user.click(screen.getByText("Configurar Pipelines"));
    await user.click(screen.getByRole("button", { name: "Renomear" }));

    expect(await screen.findByText(/O Pipeline mudou.*revise/iu)).toBeVisible();
    expect(calls).toBe(1);
    restoreLocks();
  });

  it("cria Pipeline e Stages pelo contrato dinâmico sem inventar defaults", async () => {
    const restoreLocks = installWebLocks();
    const calls: Array<{ request: Request; body: unknown }> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onPipelineMutation: (request, body) => calls.push({ request, body }),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");
    await user.click(screen.getByText("Configurar Pipelines"));

    await user.type(screen.getByLabelText("Nova etapa"), "Aprovação");
    await user.click(screen.getByRole("button", { name: "Adicionar etapa" }));
    await waitFor(() => expect(calls).toHaveLength(1));

    const firstStageName = screen.getAllByLabelText("Nome da etapa")[0];
    await user.clear(firstStageName);
    await user.type(firstStageName, "Entrada qualificada");
    await user.click(screen.getAllByRole("button", { name: "Salvar nome" })[0]);
    await waitFor(() => expect(calls).toHaveLength(2));

    await user.click(
      screen.getByRole("button", { name: "Mover Novo para baixo" }),
    );
    await waitFor(() => expect(calls).toHaveLength(3));

    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    await user.click(screen.getAllByRole("button", { name: "Arquivar" })[0]);
    await waitFor(() => expect(calls).toHaveLength(4));
    expect(confirm).toHaveBeenCalledWith(
      "A etapa precisa estar sem oportunidades abertas. Arquivar esta etapa?",
    );
    confirm.mockRestore();

    await user.type(screen.getByLabelText("Nome do Pipeline"), "Pós-venda");
    await user.type(screen.getByLabelText("Etapa 1"), "Onboarding");
    await user.click(
      screen.getByRole("button", { name: "Adicionar outra etapa" }),
    );
    await user.type(screen.getByLabelText("Etapa 2"), "Acompanhamento");
    await user.click(screen.getByRole("button", { name: "Criar Pipeline" }));
    await waitFor(() => expect(calls).toHaveLength(5));

    expect(calls.map(({ request }) => request.method)).toEqual([
      "PUT",
      "PATCH",
      "PUT",
      "POST",
      "PUT",
    ]);
    expect(new URL(calls[0]?.request.url ?? "").pathname).toMatch(
      new RegExp(
        `^/api/v1/pipelines/${testPipelineId}/stages/[0-9a-f-]+$`,
        "u",
      ),
    );
    expect(calls[0]?.body).toEqual({ name: "Aprovação" });
    expect(calls[1]?.body).toEqual({ name: "Entrada qualificada" });
    expect(calls[2]?.body).toEqual({
      stageIds: [
        testPipelineStageIds[1],
        testPipelineStageIds[0],
        ...testPipelineStageIds.slice(2),
      ],
    });
    expect(new URL(calls[3]?.request.url ?? "").pathname).toBe(
      `/api/v1/pipelines/${testPipelineId}/stages/${testPipelineStageIds[0]}/archive`,
    );
    expect(calls[4]?.body).toMatchObject({
      name: "Pós-venda",
      stages: [{ name: "Onboarding" }, { name: "Acompanhamento" }],
    });
    expect(
      (calls[4]?.body as { stages: Array<{ id: string }> }).stages.every(
        ({ id }) => /^[0-9a-f-]{36}$/u.test(id),
      ),
    ).toBe(true);
    restoreLocks();
  });

  it("traduz 403 de configuração sem repetir a escrita", async () => {
    const restoreLocks = installWebLocks();
    let calls = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        pipelineMutationStatus: 403,
        onPipelineMutation: () => (calls += 1),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");
    await user.click(screen.getByText("Configurar Pipelines"));
    await user.click(screen.getByRole("button", { name: "Renomear" }));

    expect(
      await screen.findByText("Seu papel não permite alterar Pipelines."),
    ).toBeVisible();
    expect(calls).toBe(1);
    restoreLocks();
  });
});
