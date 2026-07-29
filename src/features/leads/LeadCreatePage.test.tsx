import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import {
  createAuthHandlers,
  installWebLocks,
  testOrganizations,
} from "@/test/msw/auth-handlers";
import { createLeadHandlers, testLeadId } from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";

async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: /^Nome/iu }),
    "Lead Manual",
  );
  await user.type(
    screen.getByRole("textbox", { name: /^Telefone/iu }),
    "62999999999",
  );
}

describe("criação manual de Leads", () => {
  it("abre somente pela Inbox e cria um Lead identificado com o contrato exato", async () => {
    const restoreLocks = installWebLocks();
    const requests: Array<{ request: Request; body: unknown }> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        onCreate: (request, body) => requests.push({ request, body }),
      }),
    );
    const user = userEvent.setup();
    const app = await renderAppAt("/app/leads");
    await user.click(await screen.findByRole("link", { name: "Novo Lead" }));
    expect(
      await screen.findByRole("heading", { name: "Novo Lead" }),
    ).toBeVisible();
    await fillMinimum(user);
    await user.type(
      screen.getByRole("textbox", { name: "E-mail" }),
      "LEAD@EXAMPLE.TEST",
    );
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));

    expect(
      await screen.findByRole("heading", { name: "Lead Exemplo" }),
    ).toBeVisible();
    expect(await screen.findByText("Lead criado.")).toBeVisible();
    expect(app.router.state.location.pathname).toBe(`/app/leads/${testLeadId}`);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.request.headers.get("idempotency-key")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(requests[0]?.request.headers.has("if-match")).toBe(false);
    expect(requests[0]?.body).toEqual({
      displayName: "Lead Manual",
      primaryPhone: "(62) 99999-9999",
      email: "lead@example.test",
      source: "manual",
    });
    await waitFor(() =>
      expect(app.queryClient.getMutationCache().getAll()).toHaveLength(0),
    );
    expect(app.router.state.location.href).not.toContain("Lead%20Manual");
    restoreLocks();
  }, 20_000);

  it("trata entrada existente e replay como sucesso, nunca como erro de duplicidade", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ createStatus: 200, createReplayed: true }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    expect(await screen.findByText("Resultado confirmado.")).toBeVisible();
    expect(screen.queryByText(/duplicidade/iu)).not.toBeInTheDocument();
    restoreLocks();
  });

  it("mantém member opaco, sem diretório ou responsável", async () => {
    const restoreLocks = installWebLocks();
    let memberRequests = 0;
    let createBody: unknown;
    server.use(
      ...createAuthHandlers({ organizations: [testOrganizations[1]] }),
      ...createLeadHandlers({
        organizationId: testOrganizations[1].id,
        createStatus: 204,
        onMembers: () => (memberRequests += 1),
        onCreate: (_request, body) => (createBody = body),
      }),
    );
    const user = userEvent.setup();
    const app = await renderAppAt("/app/leads/new");
    expect(screen.queryByLabelText("Responsável")).not.toBeInTheDocument();
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    expect(
      await screen.findByRole("heading", { name: "Inbox de Leads" }),
    ).toBeVisible();
    expect(await screen.findByText("Solicitação processada.")).toBeVisible();
    expect(app.router.state.location.pathname).toBe("/app/leads");
    expect(createBody).not.toHaveProperty("responsibleMembershipId");
    expect(memberRequests).toBe(0);
    restoreLocks();
  });

  it("exige e limpa sourceDetail sem manter valor escondido", async () => {
    const restoreLocks = installWebLocks();
    let body: unknown;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onCreate: (_request, value) => (body = value) }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    await user.selectOptions(screen.getByLabelText("Origem"), "other");
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    expect(await screen.findByText("Detalhe a outra origem.")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /^Detalhe da origem/iu }),
    ).toHaveFocus();
    await user.type(
      screen.getByRole("textbox", { name: /^Detalhe da origem/iu }),
      "Evento",
    );
    await user.selectOptions(screen.getByLabelText("Origem"), "manual");
    expect(
      screen.queryByRole("textbox", { name: /^Detalhe da origem/iu }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    await screen.findByText("Lead criado.");
    expect(body).not.toHaveProperty("sourceDetail");
    restoreLocks();
  });

  it("preserva a mesma intenção e chave após resultado remoto incerto", async () => {
    const restoreLocks = installWebLocks();
    const keys: Array<string | null> = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        createNetworkFailures: 1,
        onCreate: (request) =>
          keys.push(request.headers.get("idempotency-key")),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    expect(
      await screen.findByRole("heading", { name: "Resultado não confirmado" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /^Nome/iu })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Tentar confirmar" }));
    expect(await screen.findByText("Lead criado.")).toBeVisible();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    restoreLocks();
  });

  it("bloqueia duplo submit enquanto a criação está em andamento", async () => {
    const restoreLocks = installWebLocks();
    let requests = 0;
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({
        createDelayMs: 100,
        onCreate: () => (requests += 1),
      }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    const submit = screen.getByRole("button", { name: "Criar Lead" });
    await user.dblClick(submit);
    expect(await screen.findByText("Lead criado.")).toBeVisible();
    expect(requests).toBe(1);
    restoreLocks();
  });

  it("alerta sobre nova entrada ao sair de uma intenção incerta", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ createNetworkFailures: 1 }),
    );
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    await screen.findByRole("heading", { name: "Resultado não confirmado" });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(
        /pode ter sido aplicado.*novo envio.*outra entrada/isu,
      ),
    );
    confirm.mockRestore();
    restoreLocks();
  });

  it("preserva o formulário em conflito e confirma descarte na navegação", async () => {
    const restoreLocks = installWebLocks();
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ createStatus: 409 }),
    );
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    const app = await renderAppAt("/app/leads/new");
    await fillMinimum(user);
    await user.click(screen.getByRole("button", { name: "Criar Lead" }));
    expect(await screen.findByText(/entrou em conflito/iu)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /^Nome/iu })).toHaveValue(
      "Lead Manual",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(app.router.state.location.pathname).toBe("/app/leads/new");
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(app.router.state.location.pathname).toBe("/app/leads"),
    );
    confirm.mockRestore();
    restoreLocks();
  });

  it.each([
    [400, /Revise os dados informados/iu],
    [403, /acesso à criação mudou/iu],
    [404, /responsável selecionado não está mais disponível/iu],
    [429, /Muitas tentativas/iu],
  ] as const)(
    "preserva o formulário e usa feedback seguro no erro %s",
    async (createStatus, message) => {
      const restoreLocks = installWebLocks();
      let requests = 0;
      let directoryRequests = 0;
      server.use(
        ...createAuthHandlers(),
        ...createLeadHandlers({
          createStatus,
          onCreate: () => (requests += 1),
          onMembers: () => (directoryRequests += 1),
        }),
      );
      const user = userEvent.setup();
      await renderAppAt("/app/leads/new");
      await fillMinimum(user);
      await user.click(screen.getByRole("button", { name: "Criar Lead" }));
      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.getByRole("textbox", { name: /^Nome/iu })).toHaveValue(
        "Lead Manual",
      );
      expect(requests).toBe(1);
      if (createStatus === 404)
        await waitFor(() => expect(directoryRequests).toBeGreaterThan(1));
      restoreLocks();
    },
  );

  it.each([500, 503] as const)(
    "trata %s como resultado potencialmente incerto sem retry automático",
    async (createStatus) => {
      const restoreLocks = installWebLocks();
      let requests = 0;
      server.use(
        ...createAuthHandlers(),
        ...createLeadHandlers({
          createStatus,
          onCreate: () => (requests += 1),
        }),
      );
      const user = userEvent.setup();
      await renderAppAt("/app/leads/new");
      await fillMinimum(user);
      await user.click(screen.getByRole("button", { name: "Criar Lead" }));
      expect(
        await screen.findByRole("heading", {
          name: "Resultado não confirmado",
        }),
      ).toBeVisible();
      await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
      expect(requests).toBe(1);
      restoreLocks();
    },
  );

  it("simula 401 no endpoint de criação para o ciclo de sessão existente", async () => {
    server.use(...createLeadHandlers({ createStatus: 401 }));
    const response = await fetch(new URL("/api/v1/leads", location.href), {
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-access",
        "Content-Type": "application/json",
        "Idempotency-Key": "00000000-0000-4000-8000-000000000099",
        "X-Organization-Id": "00000000-0000-4000-8000-000000000002",
      },
      body: JSON.stringify({
        displayName: "Lead sintético",
        primaryPhone: "+5562999999999",
        source: "manual",
      }),
    });
    expect(response.status).toBe(401);
  });
});
