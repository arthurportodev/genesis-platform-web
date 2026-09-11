import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import type { Organization } from "@/features/auth/api/auth-contracts";
import { renderAppAt } from "@/test/renderApp";
import { createAuthHandlers, installWebLocks } from "@/test/msw/auth-handlers";
import { server } from "@/test/msw/server";

const createdOrganization: Organization = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Agência Gênesis",
  slug: "agencia-genesis",
  membershipId: "10000000-0000-4000-8000-000000000002",
  role: "owner",
};

interface CreateRequest {
  idempotencyKey: string | null;
  authorization: string | null;
  organizationId: string | null;
  body: unknown;
}

function installJourney(
  options: {
    failFirst?: boolean;
    delayMs?: number;
  } = {},
) {
  const organizations: Organization[] = [];
  const requests: CreateRequest[] = [];
  let attempts = 0;
  server.use(
    ...createAuthHandlers({ organizations }),
    http.post("/api/v1/organizations", async ({ request }) => {
      attempts += 1;
      requests.push({
        idempotencyKey: request.headers.get("idempotency-key"),
        authorization: request.headers.get("authorization"),
        organizationId: request.headers.get("x-organization-id"),
        body: await request.json(),
      });
      if (options.delayMs) await delay(options.delayMs);
      if (options.failFirst && attempts === 1)
        return HttpResponse.json(
          { statusCode: 503, message: "Unavailable" },
          { status: 503 },
        );
      if (organizations.length === 0) organizations.push(createdOrganization);
      return HttpResponse.json(createdOrganization, {
        status: 201,
        headers: {
          Location: `/api/v1/organizations/${createdOrganization.id}`,
        },
      });
    }),
  );
  return { organizations, requests };
}

describe("SelectOrganizationPage — first organization", () => {
  let restoreLocks: (() => void) | null = null;

  beforeEach(() => {
    restoreLocks = installWebLocks();
  });

  afterEach(() => {
    restoreLocks?.();
    restoreLocks = null;
  });

  it("renders the accessible zero-state form and validates the name", async () => {
    installJourney();
    const user = userEvent.setup();
    await renderAppAt("/select-organization");

    expect(
      await screen.findByRole("heading", {
        name: "Crie sua primeira organização",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Nome da organização")).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Criar organização" }));
    const validation = await screen.findByRole("alert");
    expect(validation).toHaveTextContent("Informe o nome da organização.");
    expect(validation).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByLabelText("Nome da organização")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("accepts a decomposed Unicode name whose NFC form fits the limit", async () => {
    const { requests } = installJourney();
    const user = userEvent.setup();
    await renderAppAt("/select-organization");
    const input = await screen.findByLabelText("Nome da organização");
    const decomposed = "e\u0301".repeat(100);

    await user.type(input, decomposed);
    expect(input).toHaveValue(decomposed);
    await user.click(screen.getByRole("button", { name: "Criar organização" }));

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(requests[0]?.body).toEqual({ name: "é".repeat(100) });
  });

  it("creates without tenant header, rebootstraps, selects, and enters the app", async () => {
    const { requests } = installJourney();
    const user = userEvent.setup();
    const { router, runtime } = await renderAppAt("/select-organization");

    await user.type(
      await screen.findByLabelText("Nome da organização"),
      "  Agência Gênesis  ",
    );
    await user.click(screen.getByRole("button", { name: "Criar organização" }));

    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/app");
    expect(runtime.session.getActiveOrganizationId()).toBe(
      createdOrganization.id,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      body: { name: createdOrganization.name },
      organizationId: null,
    });
    expect(requests[0]?.authorization).toMatch(/^Bearer /u);
    expect(requests[0]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });

  it("preserves the key when retrying the same name after a recoverable error", async () => {
    const { requests } = installJourney({ failFirst: true });
    const user = userEvent.setup();
    await renderAppAt("/select-organization");
    await user.type(
      await screen.findByLabelText("Nome da organização"),
      createdOrganization.name,
    );

    await user.click(screen.getByRole("button", { name: "Criar organização" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação.",
    );
    await user.click(screen.getByRole("button", { name: "Criar organização" }));

    expect(
      await screen.findByRole("heading", { name: "Visão geral" }),
    ).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.idempotencyKey).toBe(requests[0]?.idempotencyKey);
  });

  it("starts a new key after the attempted name changes", async () => {
    const { requests } = installJourney({ failFirst: true });
    const user = userEvent.setup();
    await renderAppAt("/select-organization");
    const input = await screen.findByLabelText("Nome da organização");
    await user.type(input, "Primeira organização");
    await user.click(screen.getByRole("button", { name: "Criar organização" }));
    await screen.findByRole("alert");

    await user.clear(input);
    await user.type(input, createdOrganization.name);
    await user.click(screen.getByRole("button", { name: "Criar organização" }));

    await screen.findByRole("heading", { name: "Visão geral" });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.idempotencyKey).not.toBe(requests[0]?.idempotencyKey);
  });

  it("blocks a double submit while creation is in flight", async () => {
    const { requests } = installJourney({ delayMs: 75 });
    const user = userEvent.setup();
    await renderAppAt("/select-organization");
    await user.type(
      await screen.findByLabelText("Nome da organização"),
      createdOrganization.name,
    );
    const submit = screen.getByRole("button", { name: "Criar organização" });

    await user.dblClick(submit);

    await screen.findByRole("heading", { name: "Visão geral" });
    await waitFor(() => expect(requests).toHaveLength(1));
  });

  it("preserves logout in the zero state", async () => {
    installJourney();
    const user = userEvent.setup();
    const { router } = await renderAppAt("/select-organization");
    await user.click(await screen.findByRole("button", { name: "Sair" }));
    expect(router.state.location.pathname).toBe("/login");
  });

  it("preserves logout-all in the zero state", async () => {
    installJourney();
    const user = userEvent.setup();
    const { router } = await renderAppAt("/select-organization");
    await screen.findByRole("heading", {
      name: "Crie sua primeira organização",
    });
    await user.click(
      screen.getByRole("button", { name: "Sair de todos os dispositivos" }),
    );
    expect(router.state.location.pathname).toBe("/login");
  });
});
