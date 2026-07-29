import { AdminShell } from "@/features/admin/AdminShell";
import { SessionGate } from "@/features/auth/SessionGate";
import { isAuthenticatedState } from "@/features/auth/session/session-machine";
import { useSession } from "@/features/auth/session/useSession";
import { LeadPipelineStateProvider } from "@/features/leads/model/LeadPipelineStateProvider";
import { ActiveOrganizationProvider } from "@/shared/organization/ActiveOrganizationProvider";

export function ProtectedAdminRoute() {
  const { state } = useSession();
  if (!isAuthenticatedState(state) || !state.activeOrganization) {
    return <SessionGate />;
  }
  return (
    <ActiveOrganizationProvider
      organization={{
        id: state.activeOrganization.id,
        membershipId: state.activeOrganization.membershipId,
        name: state.activeOrganization.name,
        role: state.activeOrganization.role,
      }}
    >
      <LeadPipelineStateProvider key={state.activeOrganization.id}>
        <AdminShell />
      </LeadPipelineStateProvider>
    </ActiveOrganizationProvider>
  );
}
