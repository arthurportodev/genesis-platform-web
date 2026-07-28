import { AdminShell } from "@/features/admin/AdminShell";
import { SessionGate } from "@/features/auth/SessionGate";
import { isAuthenticatedState } from "@/features/auth/session/session-machine";
import { useSession } from "@/features/auth/session/useSession";

export function ProtectedAdminRoute() {
  const { state } = useSession();
  if (!isAuthenticatedState(state) || !state.activeOrganization) {
    return <SessionGate />;
  }
  return <AdminShell />;
}
