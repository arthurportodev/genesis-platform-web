import type { ReactNode } from "react";

import {
  ActiveOrganizationContext,
  type ActiveOrganization,
} from "@/shared/organization/active-organization";

export function ActiveOrganizationProvider({
  organization,
  children,
}: {
  organization: ActiveOrganization;
  children: ReactNode;
}) {
  return (
    <ActiveOrganizationContext.Provider value={organization}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}
