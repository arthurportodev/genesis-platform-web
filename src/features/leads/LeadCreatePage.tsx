import { useBlocker, useNavigate } from "@tanstack/react-router";
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
import { useLeadAssigneesQuery } from "@/features/leads/hooks/use-lead-queries";
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
  return (
    <OrganizationLeadCreatePage
      key={`${organization.id}:${organization.membershipId}`}
      organization={organization}
    />
  );
}

function OrganizationLeadCreatePage({
  organization,
}: {
  organization: ActiveOrganization;
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
      navigation.markDetailOrigin("inbox");
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
      await navigate({
        to: "/app/leads/$leadId",
        params: { leadId: result.lead.id },
        replace: true,
      });
    },
    [navigate, navigation],
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
        onClick={() => void navigate({ to: "/app/leads" })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para a Inbox
      </Button>
      <PageHeader
        eyebrow="Relacionamento"
        title="Novo Lead"
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
        onCancel={() => void navigate({ to: "/app/leads" })}
        onPendingChanges={setPendingChanges}
      />
    </div>
  );
}
