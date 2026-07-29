import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { LeadActions } from "@/features/leads/components/LeadActions";
import { LeadOverview } from "@/features/leads/components/LeadOverview";
import { LeadTimeline } from "@/features/leads/components/LeadTimeline";
import {
  useLeadAssigneesQuery,
  useLeadDetailQuery,
} from "@/features/leads/hooks/use-lead-queries";
import { toAppError } from "@/shared/api/errors";
import { OperationalState } from "@/shared/components/OperationalState";
import { PageHeader } from "@/shared/components/PageHeader";
import { cn } from "@/shared/lib/cn";
import { useActiveOrganization } from "@/shared/organization/active-organization";
import { Button, buttonVariants } from "@/shared/ui/Button";

export function LeadDetailPage() {
  const { leadId } = useParams({ strict: false });
  const organization = useActiveOrganization();
  const canUseDirectory =
    organization.role === "owner" || organization.role === "admin";
  const detail = useLeadDetailQuery(leadId ?? "");
  const assignees = useLeadAssigneesQuery(canUseDirectory);
  const members = useMemo(
    () => assignees.data?.pages.flatMap((page) => page.items) ?? [],
    [assignees.data],
  );

  if (detail.isPending)
    return (
      <OperationalState
        kind="loading"
        title="Carregando Lead"
        description="Consultando o detalhe na Organization ativa."
      />
    );

  if (detail.isError) {
    const error = toAppError(detail.error);
    const notFound = error.kind === "not-found";
    return (
      <div className="space-y-5">
        <Link
          to="/app/leads"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-3",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para a
          Inbox
        </Link>
        <OperationalState
          kind={notFound ? "empty" : "error"}
          title={notFound ? "Lead não encontrado" : "Detalhe indisponível"}
          description={
            error.kind === "forbidden"
              ? "Seu papel ou atribuição atual não permite acessar este Lead."
              : error.kind === "rate-limited"
                ? "Muitas consultas foram realizadas. Aguarde um instante."
                : notFound
                  ? "O Lead não existe ou não está visível nesta Organization."
                  : error.message
          }
        />
        {!notFound ? (
          <div className="text-center">
            <Button variant="secondary" onClick={() => void detail.refetch()}>
              <RefreshCw className="size-4" aria-hidden="true" /> Tentar
              novamente
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const current = detail.data;
  const lead = current.lead;
  return (
    <div className="space-y-8">
      <Link
        to="/app/leads"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-3",
        )}
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para a Inbox
      </Link>
      <PageHeader
        eyebrow="Lead"
        title={lead.displayName}
        description="Detalhe operacional, próxima ação e histórico desta oportunidade."
      />
      {canUseDirectory && assignees.isError ? (
        <p
          className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm"
          role="status"
        >
          O diretório de responsáveis está indisponível; atribuições ficam
          desabilitadas e nomes ausentes usam um rótulo protegido.
        </p>
      ) : null}
      <LeadOverview
        lead={lead}
        members={members}
        currentMembershipId={organization.membershipId}
      />
      <LeadActions
        current={current}
        members={members}
        directoryReady={!canUseDirectory || assignees.isSuccess}
        hasMoreMembers={assignees.hasNextPage === true}
        loadingMoreMembers={assignees.isFetchingNextPage}
        onLoadMoreMembers={() => void assignees.fetchNextPage()}
      />
      <LeadTimeline leadId={lead.id} />
    </div>
  );
}
