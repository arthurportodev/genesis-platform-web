import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderAppAt } from "@/test/renderApp";
import { createAuthHandlers, installWebLocks } from "@/test/msw/auth-handlers";
import { createLeadHandlers, testLeadId } from "@/test/msw/lead-handlers";
import { server } from "@/test/msw/server";

async function openMove(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    (
      await screen.findAllByRole("button", {
        name: /Mover Lead Exemplo para outra etapa/iu,
      })
    )[0],
  );
  await user.click(await screen.findByRole("menuitem", { name: /Proposta/iu }));
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
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect((await screen.findAllByText("Lead Exemplo"))[0]).toBeVisible();
    expect(screen.queryByText("+5511999999999")).not.toBeInTheDocument();
    expect(screen.queryByText("lead@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText(testLeadId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Pipeline de Leads" }),
    ).toBeInTheDocument();
    restoreLocks();
  });

  it("debounceia busca, não consulta termo curto e reinicia o quadro", async () => {
    const restoreLocks = installWebLocks();
    const requests: URL[] = [];
    server.use(
      ...createAuthHandlers(),
      ...createLeadHandlers({ onKanban: (url) => requests.push(url) }),
    );
    const user = userEvent.setup();
    await renderAppAt("/app/pipeline");
    await screen.findAllByText("Lead Exemplo");
    const initial = requests.length;
    const search = screen.getAllByLabelText("Buscar", {
      selector: "input",
    })[0];
    await user.type(search, "Jo");
    await act(
      () => new Promise((resolve) => globalThis.setTimeout(resolve, 450)),
    );
    expect(requests).toHaveLength(initial);
    expect(screen.getAllByText(/ao menos 3 caracteres/iu)[0]).toBeVisible();
    await user.type(search, "sé");
    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("q")).toBe("José"),
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
        moveDelayMs: 120,
        onDetail: () => (details += 1),
        onMutation: (request) =>
          calls.push({
            ifMatch: request.headers.get("if-match"),
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
    expect(screen.getAllByText("Lead Exemplo")[0]).toBeVisible();
    expect(await screen.findByText("Lead movido com sucesso.")).toBeVisible();
    expect(details).toBe(1);
    expect(calls[0]?.ifMatch).toBe(`"lead:${testLeadId}:3"`);
    expect(typeof calls[0]?.key).toBe("string");
    expect(document.activeElement).toHaveAttribute(
      "data-pipeline-column-heading",
      "proposal",
    );
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
    expect(document.activeElement).toHaveAccessibleName(/Mover Lead Exemplo/iu);
    restoreLocks();
  });
});
