import { createContext, useContext } from "react";

export type OrganizationRole = "owner" | "admin" | "member";

export interface ActiveOrganization {
  id: string;
  membershipId: string;
  name: string;
  role: OrganizationRole;
}

export const ActiveOrganizationContext =
  createContext<ActiveOrganization | null>(null);

export function useActiveOrganization(): ActiveOrganization {
  const organization = useContext(ActiveOrganizationContext);
  if (!organization) throw new Error("ActiveOrganizationProvider ausente.");
  return organization;
}
