import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
} from "@/test/msw/auth-handlers";
import {
  createLeadHandlers,
  testLead,
  testLeadId,
  testMemberId,
} from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";
import { createLeadSnapshot } from "@/features/leads/api/lead-snapshot";
import { leadQueryKeys } from "@/features/leads/api/lead-query-keys";

describe("Inbox e detalhe do Lead", () => {
  it("lista, busca com debounce e não consulta termo curto", async () => {
    const restoreLocks = installWebLocks();
    const requested: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onList: (url) => requested.push(url) }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads");

    expect(
      await screen.findByRole("heading", { name: "Inbox de Leads" }),
    ).toBeVisible();
    expect((await screen.findAllByText("Lead Exemplo"))[0]).toBeVisible();
    const initialRequests = requested.length;
    await user.clear(screen.getByLabelText("Buscar"));
    await user.type(screen.getByLabelText("Buscar"), "Jo");
    await act(
      () => new Promise((resolve) => globalThis.setTimeout(resolve, 450)),
    );
    expect(requested).toHaveLength(initialRequests);
    expect(screen.getAllByText(/ao menos 3 caracteres/iu)[0]).toBeVisible();

    await user.type(screen.getByLabelText("Buscar"), "sé");
    await waitFor(() =>
      expect(requested.at(-1)?.searchParams.get("q")).toBe("José"),
    );
    restoreLocks();
  });

  it("abre deep link, mostra histórico ASC e envia nota com os dois headers", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    expect(
      await screen.findByRole("heading", { name: "Lead Exemplo" }),
    ).toBeVisible();
    expect(
      await screen.findByText("Histórico em ordem cronológica"),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Conteúdo da nota"),
      "Contato realizado",
    );
    await user.click(screen.getByRole("button", { name: "Adicionar nota" }));
    expect(await screen.findByText("Nota adicionada.")).toBeVisible();
    restoreLocks();
  });

  it("navega por cursor e retorna pela pilha local", async () => {
    const restoreLocks = installWebLocks();
    const requested: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        nextCursor: "cursor-seguinte",
        onList: (url) => requested.push(url),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads");
    await screen.findAllByText("Lead Exemplo");

    await user.click(screen.getByRole("button", { name: /Próxima/iu }));
    await waitFor(() =>
      expect(requested.at(-1)?.searchParams.get("cursor")).toBe(
        "cursor-seguinte",
      ),
    );
    await user.click(screen.getByRole("button", { name: /Anterior/iu }));
    expect(await screen.findByText("Página 1")).toBeVisible();
    expect(screen.getByRole("button", { name: /Anterior/iu })).toBeDisabled();
    restoreLocks();
  });

  it("apresenta indisponibilidade 503 sem expor detalhes do backend", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ listStatus: 503 }),
    );
    await renderAppAt("/app/leads");
    expect(
      await screen.findByText(
        "A leitura operacional está temporariamente indisponível.",
        {},
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(screen.queryByText("List unavailable")).not.toBeInTheDocument();
    restoreLocks();
  });

  it("preserva o rascunho e recarrega após conflito 412", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ mutationStatus: 412 }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);
    const note = await screen.findByLabelText("Conteúdo da nota");
    await user.type(note, "Rascunho preservado");
    await user.click(screen.getByRole("button", { name: "Adicionar nota" }));
    expect(await screen.findByText(/rascunho foi preservado/iu)).toBeVisible();
    expect(note).toHaveValue("Rascunho preservado");
    restoreLocks();
  });

  it("hidrata o e-mail existente e o preserva ao salvar outro campo", async () => {
    const restoreLocks = installWebLocks();
    let updateBody: Promise<unknown> | undefined;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onMutation: (request) => {
          if (new URL(request.url).pathname === `/api/v1/leads/${testLeadId}`)
            updateBody = request.clone().json();
        },
      }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    const email = await screen.findByLabelText("E-mail");
    expect(email).toHaveValue("lead@example.test");
    const city = screen.getByLabelText("Cidade");
    await user.clear(city);
    await user.type(city, "Campinas");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await updateBody).toMatchObject({
      email: "lead@example.test",
      city: "Campinas",
    });
    restoreLocks();
  });

  it("mantém Lead sem e-mail editável sem inventar valor", async () => {
    const restoreLocks = installWebLocks();
    let updateBody: Promise<unknown> | undefined;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        detailEmail: null,
        onMutation: (request) => {
          if (new URL(request.url).pathname === `/api/v1/leads/${testLeadId}`)
            updateBody = request.clone().json();
        },
      }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    expect(await screen.findByLabelText("E-mail")).toHaveValue("");
    const city = screen.getByLabelText("Cidade");
    await user.clear(city);
    await user.type(city, "Belém");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await updateBody).toMatchObject({ email: null, city: "Belém" });
    restoreLocks();
  });

  it("reinicializa a edição com o e-mail do Lead selecionado", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ detailEmail: null }),
    );
    const secondLeadId = "00000000-0000-4000-8000-000000000020";
    const secondLead = {
      ...testLead,
      id: secondLeadId,
      displayName: "Segundo Lead",
      email: "segundo@example.test",
    };
    const { queryClient, router } = await renderAppAt(
      `/app/leads/${testLeadId}`,
    );
    expect(await screen.findByLabelText("E-mail")).toHaveValue("");

    queryClient.setQueryData(
      leadQueryKeys.detail(testOrganizations[0].id, secondLeadId),
      {
        lead: secondLead,
        snapshot: createLeadSnapshot(
          `"lead:${secondLeadId}:3"`,
          secondLeadId,
          "3",
        ),
      },
    );
    queryClient.setQueryData(
      leadQueryKeys.timeline(testOrganizations[0].id, secondLeadId),
      {
        pages: [{ items: [], page: { nextCursor: null, limit: 50 } }],
        pageParams: [undefined],
      },
    );

    await act(async () => {
      await router.navigate({
        to: "/app/leads/$leadId",
        params: { leadId: secondLeadId },
      });
    });

    expect(
      await screen.findByRole("heading", { name: "Segundo Lead" }),
    ).toBeVisible();
    expect(screen.getByLabelText("E-mail")).toHaveValue("segundo@example.test");
    restoreLocks();
  });

  it("salva a etapa imediatamente e mantém o valor após nova leitura", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ moveDelayMs: 100 }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    const stage = await screen.findByLabelText("Etapa");
    await user.selectOptions(stage, "proposal");
    expect(screen.getByText("Salvando etapa...")).toBeVisible();
    expect(await screen.findByText("Etapa atualizada.")).toBeVisible();
    expect(screen.getByLabelText("Etapa")).toHaveValue("proposal");
    expect(screen.queryByRole("button", { name: "Mover Lead" })).toBeNull();
    restoreLocks();
  });

  it("reverte a etapa selecionada quando a persistência falha", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ mutationStatus: 500 }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    const stage = await screen.findByLabelText("Etapa");
    await user.selectOptions(stage, "proposal");
    expect(
      await screen.findByText(/não foi confirmada como salva/iu),
    ).toBeVisible();
    expect(stage).toHaveValue("qualification");
    expect(screen.queryByText(/Etapa salva:/iu)).toBeNull();
    restoreLocks();
  });

  it.each([
    [403, "Seu papel não permite consultar esta seleção de Leads."],
    [
      429,
      "A Inbox recebeu muitas consultas. Aguarde um instante e tente novamente.",
    ],
  ])("presents a safe message for HTTP %s", async (listStatus, message) => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers({ listStatus }));
    await renderAppAt("/app/leads");
    expect(
      await screen.findByText(message, {}, { timeout: 5_000 }),
    ).toBeVisible();
    expect(screen.queryByText("List unavailable")).not.toBeInTheDocument();
    restoreLocks();
  });

  it("keeps an assigned member visible outside the loaded directory page", async () => {
    const restoreLocks = installWebLocks();
    server.use(...createAuthHandlers(), ...createLeadHandlers());
    await renderAppAt(`/app/leads/${testLeadId}`);

    const select = await screen.findByLabelText("Responsável ativo");
    expect(select).toHaveValue("00000000-0000-4000-8000-000000000003");
    expect(
      screen.getByRole("option", { name: "Responsável atribuído" }),
    ).toBeInTheDocument();
    restoreLocks();
  });

  it("does not render operational actions for an unrelated member", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers({ organizations: [testOrganizations[1]] }),
      ...createLeadHandlers({ organizationId: testOrganizations[1].id }),
    );
    await renderAppAt(`/app/leads/${testLeadId}`);

    expect(
      await screen.findByRole("heading", { name: "Lead Exemplo" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Ações" }),
    ).not.toBeInTheDocument();
    restoreLocks();
  });

  it("executes representative PATCH and idempotent operations through MSW", async () => {
    const restoreLocks = installWebLocks();
    const calls: Array<{ path: string; key: string | null }> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onMutation: (request) =>
          calls.push({
            path: new URL(request.url).pathname,
            key: request.headers.get("idempotency-key"),
          }),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt(`/app/leads/${testLeadId}`);

    const name = await screen.findByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Lead Atualizado");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Dados do Lead atualizados.")).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText("Responsável ativo"),
      testMemberId,
    );
    await user.click(
      screen.getByRole("button", { name: "Atualizar responsável" }),
    );
    expect(await screen.findByText("Responsável atualizado.")).toBeVisible();

    await user.click(
      screen.getByText("Registrar atividade", { selector: "summary" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Registrar atividade" }),
    );
    expect(await screen.findByText("Atividade registrada.")).toBeVisible();

    await user.click(
      screen.getByText("Criar próxima ação", { selector: "summary" }),
    );
    await user.type(screen.getByLabelText("Descrição"), "Retornar amanhã");
    await user.click(
      screen.getByRole("button", { name: "Criar próxima ação" }),
    );
    expect(await screen.findByText("Próxima ação criada.")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Etapa"), "proposal");
    expect(await screen.findByText("Etapa atualizada.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Marcar como ganho" }));
    expect(await screen.findByText("Lead marcado como ganho.")).toBeVisible();

    expect(calls.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        `/api/v1/leads/${testLeadId}`,
        `/api/v1/leads/${testLeadId}/assignment`,
        `/api/v1/leads/${testLeadId}/activities`,
        `/api/v1/leads/${testLeadId}/next-action`,
        `/api/v1/leads/${testLeadId}/move`,
        `/api/v1/leads/${testLeadId}/win`,
      ]),
    );
    const idempotentKeys = calls.filter(({ key }) => key).map(({ key }) => key);
    expect(new Set(idempotentKeys).size).toBe(idempotentKeys.length);
    restoreLocks();
  }, 20_000);
});
