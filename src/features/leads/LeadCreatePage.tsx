import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { leadCreationCapabilities } from "@/features/leads/api/lead-capabilities";
import type {
  CreateLeadInput,
  CreateLeadResult,
} from "@/features/leads/api/lead-contracts";
import { LeadCreateFeedback } from "@/features/leads/components/LeadCreateFeedback";
import { LeadCreateForm } from "@/features/leads/components/LeadCreateForm";
import { useCreateLead } from "@/features/leads/hooks/use-create-lead";
import {
  useLeadAssigneesQuery,
  usePipelinesQuery,
} from "@/features/leads/hooks/use-lead-queries";
import { useLeadNavigationState } from "@/features/leads/model/lead-navigation-state";
import { PageHeader } from "@/shared/components/PageHeader";
import { usePendingChangesRegistration } from "@/shared/navigation/pending-changes";
import {
  useActiveOrganization,
  type ActiveOrganization,
} from "@/shared/organization/active-organization";
import { Button } from "@/shared/ui/Button";

const uncertainDiscardWarning =
  "O resultado pode ter sido aplicado. Sair agora abandona esta chave; um novo envio pode registrar outra entrada. Deseja sair mesmo assim?";

export function LeadCreatePage() {
  const organization = useActiveOrganization();
  const search = useSearch({ from: "/app/leads/new" });
  const pipelines = usePipelinesQuery();
  const fixedPipeline = pipelines.data
    ? (pipelines.data.find((pipeline) => pipeline.id === search.pipelineId) ??
      (search.from === "pipeline" && !search.pipelineId
        ? pipelines.data.find((pipeline) => pipeline.isDefault)
        : undefined))
    : undefined;
  if (pipelines.isPending) return <p role="status">Carregando Pipelines…</p>;
  if (pipelines.isError || (search.from === "pipeline" && !fixedPipeline))
    return (
      <p
        role="alert"
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
      >
        Não foi possível confirmar o Pipeline desta criação.
      </p>
    );
  return (
    <OrganizationLeadCreatePage
      key={`${organization.id}:${organization.membershipId}`}
      organization={organization}
      fromPipeline={search.from === "pipeline"}
      pipelines={pipelines.data}
      fixedPipeline={fixedPipeline}
    />
  );
}

function OrganizationLeadCreatePage({
  organization,
  fromPipeline,
  pipelines,
  fixedPipeline,
}: {
  organization: ActiveOrganization;
  fromPipeline: boolean;
  pipelines: readonly import("@/features/leads/api/lead-contracts").Pipeline[];
  fixedPipeline?: import("@/features/leads/api/lead-contracts").Pipeline;
}) {
  const capabilities = leadCreationCapabilities(organization);
  const assignees = useLeadAssigneesQuery(capabilities.canChooseResponsible);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );
  const creation = useCreateLead(organization);
  const navigation = useLeadNavigationState();
  const navigate = useNavigate();
  const allowNavigation = useRef(false);
  const [pendingChanges, setPendingChanges] = useState(false);
  const returnTo = fromPipeline ? "/app/pipeline" : "/app/leads";
  const returnSearch = fromPipeline
    ? { pipelineId: fixedPipeline?.id }
    : undefined;
  const shouldBlock = pendingChanges || creation.uncertain;
  usePendingChangesRegistration(
    shouldBlock,
    creation.uncertain ? uncertainDiscardWarning : undefined,
  );
  useBlocker({
    disabled: !shouldBlock,
    enableBeforeUnload: shouldBlock,
    shouldBlockFn: () =>
      !allowNavigation.current &&
      !globalThis.confirm(
        creation.uncertain
          ? uncertainDiscardWarning
          : "Descartar os dados preenchidos e sair da criação de Lead?",
      ),
  });

  const complete = useCallback(
    async (result: CreateLeadResult | null) => {
      if (!result) return;
      allowNavigation.current = true;
      if (result.kind === "opaque") {
        navigation.setCreationNotice("lead-submission-received");
        await navigate({ to: "/app/leads", replace: true });
        return;
      }
      navigation.setCreationNotice(
        result.replayed
          ? "lead-create-replay-confirmed"
          : result.status === 201
            ? "lead-created"
            : "lead-existing-entry-recorded",
      );
      if (fromPipeline) {
        if (result.status === 200) {
          navigation.markDetailOrigin("pipeline");
          await navigate({
            to: "/app/leads/$leadId",
            params: { leadId: result.lead.id },
            replace: true,
          });
          return;
        }
        await navigate({
          to: "/app/pipeline",
          search: { pipelineId: fixedPipeline?.id },
          replace: true,
        });
        return;
      }
      navigation.markDetailOrigin("inbox");
      await navigate({
        to: "/app/leads/$leadId",
        params: { leadId: result.lead.id },
        replace: true,
      });
    },
    [fixedPipeline?.id, fromPipeline, navigate, navigation],
  );

  const submit = async (input: CreateLeadInput) => {
    await complete(await creation.submit(input));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        className="-ml-3 min-h-11"
        onClick={() => void navigate({ to: returnTo, search: returnSearch })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {fromPipeline ? "Voltar para o Pipeline" : "Voltar para a Inbox"}
      </Button>
      <PageHeader
        eyebrow={fromPipeline ? "Vendas" : "Relacionamento"}
        title={fromPipeline ? "Nova oportunidade" : "Novo Lead"}
        description="Registre uma oportunidade manualmente. O serviço valida o telefone, a Organization e as permissões antes de confirmar."
      />
      <LeadCreateFeedback
        feedback={creation.feedback}
        busy={creation.busy}
        onRetry={() => void creation.retry().then(complete)}
        onAbandon={creation.abandon}
      />
      <LeadCreateForm
        key={organization.id}
        pipelines={pipelines}
        fixedPipeline={fixedPipeline}
        canChooseResponsible={capabilities.canChooseResponsible}
        members={members}
        directoryPending={assignees.isPending}
        directoryError={assignees.isError}
        hasMoreMembers={assignees.hasNextPage === true}
        loadingMoreMembers={assignees.isFetchingNextPage}
        busy={creation.busy}
        uncertain={creation.uncertain}
        onLoadMoreMembers={() => void assignees.fetchNextPage()}
        onSubmit={submit}
        onCancel={() => void navigate({ to: returnTo, search: returnSearch })}
        onPendingChanges={setPendingChanges}
      />
    </div>
  );
}
