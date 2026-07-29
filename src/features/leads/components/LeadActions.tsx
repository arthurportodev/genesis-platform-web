import { useRef, useState, type FormEvent } from "react";

import {
  activityTypes,
  archiveReasons,
  leadStages,
  lostReasons,
  nextActionTypes,
  type LeadDetail,
  type Member,
} from "@/features/leads/api/lead-contracts";
import { leadCapabilities } from "@/features/leads/api/lead-capabilities";
import {
  hasUncertainMutationOutcome,
  LeadIntentKeyRegistry,
} from "@/features/leads/api/lead-intent-keys";
import { stageLabels } from "@/features/leads/api/lead-labels";
import type {
  LeadDetailSnapshot,
  LeadIdempotentAction,
} from "@/features/leads/api/lead-api";
import { useLeadMutations } from "@/features/leads/hooks/use-lead-mutations";
import { toAppError } from "@/shared/api/errors";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Label } from "@/shared/ui/Label";
import { Select } from "@/shared/ui/Select";
import { Textarea } from "@/shared/ui/Textarea";

function localDateTimeValue(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function LeadActions({
  current,
  members,
  hasMoreMembers,
  loadingMoreMembers,
  onLoadMoreMembers,
  directoryReady,
}: {
  current: LeadDetailSnapshot;
  members: readonly Member[];
  hasMoreMembers: boolean;
  loadingMoreMembers: boolean;
  onLoadMoreMembers: () => void;
  directoryReady: boolean;
}) {
  const organization = useActiveOrganization();
  const lead = current.lead;
  const capabilities = leadCapabilities(organization, lead);
  const mutations = useLeadMutations(lead.id);
  const intentKeys = useRef(new LeadIntentKeyRegistry());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy =
    mutations.update.isPending ||
    mutations.assign.isPending ||
    mutations.act.isPending;

  const reportError = async (cause: unknown) => {
    const appError = toAppError(cause);
    if (
      appError.kind === "conflict" ||
      appError.kind === "precondition-failed"
    ) {
      await mutations.refreshLead();
      setError(
        "Este Lead mudou enquanto você editava. Os dados atuais foram recarregados; seu rascunho foi preservado para revisão.",
      );
      return;
    }
    setError(appError.message);
  };

  const runAction = async (
    intentName: string,
    intent: LeadIdempotentAction,
    successMessage: string,
    onSuccess?: () => void,
  ) => {
    setError(null);
    setMessage(null);
    const key = intentKeys.current.keyFor(intentName, intent);
    try {
      await mutations.act.mutateAsync({ current, intent, idempotencyKey: key });
      intentKeys.current.forget(intentName);
      setMessage(successMessage);
      onSuccess?.();
    } catch (cause) {
      const appError = toAppError(cause);
      if (!hasUncertainMutationOutcome(appError.kind))
        intentKeys.current.forget(intentName);
      await reportError(appError);
    }
  };

  if (!Object.values(capabilities).some(Boolean)) return null;

  return (
    <section aria-labelledby="lead-actions-title" className="space-y-4">
      <div>
        <h2 id="lead-actions-title" className="text-lg font-semibold">
          Ações
        </h2>
        <p className="text-sm text-muted-foreground">
          As opções respeitam seu papel, a atribuição e o estado atual do Lead.
        </p>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-info/20 bg-info/10 p-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {capabilities.canEdit ? (
          <EditLeadCard
            current={current}
            busy={busy}
            onSave={async (body) => {
              setError(null);
              setMessage(null);
              try {
                await mutations.update.mutateAsync({ current, body });
                setMessage("Dados do Lead atualizados.");
              } catch (cause) {
                await reportError(cause);
              }
            }}
          />
        ) : null}
        {capabilities.canAssign && directoryReady ? (
          <AssignmentCard
            lead={lead}
            members={members}
            busy={busy}
            hasMore={hasMoreMembers}
            loadingMore={loadingMoreMembers}
            onLoadMore={onLoadMoreMembers}
            onAssign={async (responsibleMembershipId) => {
              setError(null);
              setMessage(null);
              try {
                await mutations.assign.mutateAsync({
                  current,
                  responsibleMembershipId,
                });
                setMessage("Responsável atualizado.");
              } catch (cause) {
                await reportError(cause);
              }
            }}
          />
        ) : null}
        {capabilities.canFollowUp ? (
          <FollowUpCard lead={lead} busy={busy} runAction={runAction} />
        ) : null}
        {capabilities.canMove ||
        capabilities.canClose ||
        capabilities.canArchive ||
        capabilities.canReactivate ||
        capabilities.canDismissReturn ? (
          <LifecycleCard
            lead={lead}
            busy={busy}
            capabilities={capabilities}
            runAction={runAction}
          />
        ) : null}
      </div>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function EditLeadCard({
  current,
  busy,
  onSave,
}: {
  current: LeadDetailSnapshot;
  busy: boolean;
  onSave: (body: {
    displayName: string;
    primaryPhone: string;
    email: string | null;
    companyName: string | null;
    instagram: string | null;
    city: string | null;
    serviceInterest: string | null;
  }) => Promise<void>;
}) {
  const lead = current.lead;
  const [displayName, setDisplayName] = useState(lead.displayName);
  const [primaryPhone, setPrimaryPhone] = useState(lead.primaryPhone);
  const [email, setEmail] = useState(lead.email ?? "");
  const [companyName, setCompanyName] = useState(lead.companyName ?? "");
  const [instagram, setInstagram] = useState(lead.instagram ?? "");
  const [city, setCity] = useState(lead.city ?? "");
  const [serviceInterest, setServiceInterest] = useState(
    lead.serviceInterest ?? "",
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSave({
      displayName: displayName.normalize("NFC").trim(),
      primaryPhone: primaryPhone.trim(),
      email: email.trim() || null,
      companyName: companyName.normalize("NFC").trim() || null,
      instagram: instagram.normalize("NFC").trim() || null,
      city: city.normalize("NFC").trim() || null,
      serviceInterest: serviceInterest.normalize("NFC").trim() || null,
    });
  };
  return (
    <Panel title="Editar informações">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <Field
          label="Nome"
          value={displayName}
          onChange={setDisplayName}
          required
          maxLength={160}
        />
        <Field
          label="Telefone"
          value={primaryPhone}
          onChange={setPrimaryPhone}
          required
          maxLength={40}
        />
        <Field
          label="E-mail"
          value={email}
          onChange={setEmail}
          type="email"
          maxLength={320}
        />
        <Field
          label="Empresa"
          value={companyName}
          onChange={setCompanyName}
          maxLength={160}
        />
        <Field
          label="Instagram"
          value={instagram}
          onChange={setInstagram}
          maxLength={64}
        />
        <Field label="Cidade" value={city} onChange={setCity} maxLength={120} />
        <Field
          label="Interesse"
          value={serviceInterest}
          onChange={setServiceInterest}
          maxLength={160}
        />
        <Button className="sm:col-span-2" disabled={busy}>
          Salvar alterações
        </Button>
      </form>
    </Panel>
  );
}

function AssignmentCard({
  lead,
  members,
  busy,
  hasMore,
  loadingMore,
  onLoadMore,
  onAssign,
}: {
  lead: LeadDetail;
  members: readonly Member[];
  busy: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onAssign: (membershipId: string | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState(lead.responsibleMembershipId ?? "");
  const assignedMemberIsMissing =
    Boolean(lead.responsibleMembershipId) &&
    !members.some((member) => member.id === lead.responsibleMembershipId);
  return (
    <Panel title="Responsável">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onAssign(selected || null);
        }}
      >
        <div>
          <Label htmlFor="lead-assignee">Responsável ativo</Label>
          <Select
            id="lead-assignee"
            className="mt-1.5"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Sem responsável</option>
            {assignedMemberIsMissing ? (
              <option value={lead.responsibleMembershipId ?? ""}>
                Responsável atribuído
              </option>
            ) : null}
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy}>Atualizar responsável</Button>
          {hasMore ? (
            <Button
              type="button"
              variant="secondary"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? "Carregando…" : "Carregar mais pessoas"}
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function FollowUpCard({
  lead,
  busy,
  runAction,
}: {
  lead: LeadDetail;
  busy: boolean;
  runAction: (
    name: string,
    intent: LeadIdempotentAction,
    message: string,
    onSuccess?: () => void,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [activityType, setActivityType] =
    useState<(typeof activityTypes)[number]>("whatsapp");
  const [performedAt, setPerformedAt] = useState(localDateTimeValue());
  const [outcome, setOutcome] = useState("");
  const [nextType, setNextType] =
    useState<(typeof nextActionTypes)[number]>("follow_up");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(localDateTimeValue());
  const [cancelNote, setCancelNote] = useState("");
  return (
    <Panel title="Atendimento e próxima ação">
      <details open>
        <summary className="cursor-pointer font-semibold">
          Adicionar nota
        </summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              "note",
              {
                action: "note",
                body: { content: note.normalize("NFC").trim() },
              },
              "Nota adicionada.",
              () => setNote(""),
            );
          }}
        >
          <Textarea
            aria-label="Conteúdo da nota"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            required
          />
          <Button disabled={busy || note.trim() === ""}>Adicionar nota</Button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">
          Registrar atividade
        </summary>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              "activity",
              {
                action: "activity",
                body: {
                  type: activityType,
                  performedAt: new Date(performedAt).toISOString(),
                  ...(outcome.trim()
                    ? { outcome: outcome.normalize("NFC").trim() }
                    : {}),
                },
              },
              "Atividade registrada.",
              () => setOutcome(""),
            );
          }}
        >
          <EnumSelect
            label="Tipo de atividade"
            value={activityType}
            values={activityTypes}
            onChange={(value) => setActivityType(value as typeof activityType)}
          />
          <Field
            label="Realizada em"
            value={performedAt}
            onChange={setPerformedAt}
            type="datetime-local"
            required
          />
          <Field label="Resultado" value={outcome} onChange={setOutcome} />
          <Button disabled={busy}>Registrar atividade</Button>
        </form>
      </details>
      {lead.nextAction ? (
        <details>
          <summary className="cursor-pointer font-semibold">
            Gerenciar próxima ação
          </summary>
          <div className="mt-3 space-y-3">
            <Field
              label="Nova data"
              value={dueAt}
              onChange={setDueAt}
              type="datetime-local"
              required
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void runAction(
                  "next-reschedule",
                  {
                    action: "next-action-reschedule",
                    body: { dueAt: new Date(dueAt).toISOString() },
                  },
                  "Próxima ação reagendada.",
                )
              }
            >
              Reagendar
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void runAction(
                  "next-complete",
                  {
                    action: "next-action-complete",
                    body: { performedAt: new Date().toISOString() },
                  },
                  "Próxima ação concluída.",
                )
              }
            >
              Concluir
            </Button>
            <Field
              label="Motivo do cancelamento"
              value={cancelNote}
              onChange={setCancelNote}
            />
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void runAction(
                  "next-cancel",
                  {
                    action: "next-action-cancel",
                    body: cancelNote.trim()
                      ? { note: cancelNote.normalize("NFC").trim() }
                      : {},
                  },
                  "Próxima ação cancelada.",
                  () => setCancelNote(""),
                )
              }
            >
              Cancelar próxima ação
            </Button>
          </div>
        </details>
      ) : (
        <details>
          <summary className="cursor-pointer font-semibold">
            Criar próxima ação
          </summary>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                "next-create",
                {
                  action: "next-action-create",
                  body: {
                    type: nextType,
                    description: description.normalize("NFC").trim(),
                    dueAt: new Date(dueAt).toISOString(),
                  },
                },
                "Próxima ação criada.",
                () => setDescription(""),
              );
            }}
          >
            <EnumSelect
              label="Tipo"
              value={nextType}
              values={nextActionTypes}
              onChange={(value) => setNextType(value as typeof nextType)}
            />
            <Field
              label="Descrição"
              value={description}
              onChange={setDescription}
              required
            />
            <Field
              label="Data"
              value={dueAt}
              onChange={setDueAt}
              type="datetime-local"
              required
            />
            <Button disabled={busy}>Criar próxima ação</Button>
          </form>
        </details>
      )}
    </Panel>
  );
}

function LifecycleCard({
  lead,
  busy,
  capabilities,
  runAction,
}: {
  lead: LeadDetail;
  busy: boolean;
  capabilities: ReturnType<typeof leadCapabilities>;
  runAction: (
    name: string,
    intent: LeadIdempotentAction,
    message: string,
  ) => Promise<void>;
}) {
  const [stage, setStage] = useState<(typeof leadStages)[number]>(lead.stage);
  const [lostReason, setLostReason] =
    useState<(typeof lostReasons)[number]>("not_now");
  const [archiveReason, setArchiveReason] =
    useState<(typeof archiveReasons)[number]>("outdated");
  const [reasonNote, setReasonNote] = useState("");
  return (
    <Panel title="Ciclo comercial">
      <div className="space-y-3">
        {capabilities.canMove ? (
          <>
            <EnumSelect
              label="Etapa"
              value={stage}
              values={leadStages}
              labels={stageLabels}
              onChange={(value) => setStage(value as typeof stage)}
            />
            <Button
              variant="secondary"
              disabled={busy || stage === lead.stage}
              onClick={() =>
                void runAction(
                  "move",
                  { action: "move", body: { stage } },
                  "Etapa atualizada.",
                )
              }
            >
              Mover Lead
            </Button>
          </>
        ) : null}
        {capabilities.canClose ? (
          <>
            <Button
              disabled={busy}
              onClick={() =>
                void runAction(
                  "win",
                  { action: "win", body: {} },
                  "Lead marcado como ganho.",
                )
              }
            >
              Marcar como ganho
            </Button>
            <details>
              <summary className="cursor-pointer font-semibold">
                Marcar como perdido
              </summary>
              <div className="mt-3 space-y-3">
                <EnumSelect
                  label="Motivo da perda"
                  value={lostReason}
                  values={lostReasons}
                  onChange={(value) =>
                    setLostReason(value as typeof lostReason)
                  }
                />
                <Field
                  label="Observação"
                  value={reasonNote}
                  onChange={setReasonNote}
                  maxLength={500}
                />
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      "lose",
                      {
                        action: "lose",
                        body: {
                          lostReason,
                          ...(reasonNote.trim()
                            ? { reasonNote: reasonNote.normalize("NFC").trim() }
                            : {}),
                        },
                      },
                      "Lead marcado como perdido.",
                    )
                  }
                >
                  Confirmar perda
                </Button>
              </div>
            </details>
          </>
        ) : null}
        {capabilities.canArchive ? (
          <details>
            <summary className="cursor-pointer font-semibold">
              Arquivar Lead
            </summary>
            <div className="mt-3 space-y-3">
              <EnumSelect
                label="Motivo do arquivamento"
                value={archiveReason}
                values={archiveReasons}
                onChange={(value) =>
                  setArchiveReason(value as typeof archiveReason)
                }
              />
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    "archive",
                    {
                      action: "archive",
                      body: {
                        archiveReason,
                        ...(reasonNote.trim()
                          ? { reasonNote: reasonNote.normalize("NFC").trim() }
                          : {}),
                      },
                    },
                    "Lead arquivado.",
                  )
                }
              >
                Arquivar
              </Button>
            </div>
          </details>
        ) : null}
        {capabilities.canReactivate ? (
          <Button
            disabled={busy}
            onClick={() =>
              void runAction(
                "reactivate",
                { action: "reactivate", body: {} },
                "Lead reativado.",
              )
            }
          >
            Reativar Lead
          </Button>
        ) : null}
        {capabilities.canDismissReturn ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void runAction(
                "dismiss-return",
                { action: "dismiss-return", body: {} },
                "Revisão de retorno dispensada.",
              )
            }
          >
            Dispensar revisão de retorno
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const id = `lead-field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1.5"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
      />
    </div>
  );
}

function EnumSelect({
  label,
  value,
  values,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const id = `lead-enum-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        className="mt-1.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {labels?.[item] ?? item.replaceAll("_", " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
