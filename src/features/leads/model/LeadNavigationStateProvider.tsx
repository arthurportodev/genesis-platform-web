import { useMemo, useState, type ReactNode } from "react";

import {
  LeadNavigationStateContext,
  type LeadDetailOrigin,
} from "@/features/leads/model/lead-navigation-state";

export function LeadNavigationStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [detailOrigin, setDetailOrigin] = useState<LeadDetailOrigin | null>(
    null,
  );
  const [returnScrollY, setReturnScrollY] = useState(0);
  const value = useMemo(
    () => ({
      detailOrigin,
      returnScrollY,
      markDetailOrigin: (origin: LeadDetailOrigin, scrollY = 0) => {
        setDetailOrigin(origin);
        setReturnScrollY(Math.max(0, scrollY));
      },
      clearDetailOrigin: () => {
        setDetailOrigin(null);
        setReturnScrollY(0);
      },
    }),
    [detailOrigin, returnScrollY],
  );
  return (
    <LeadNavigationStateContext.Provider value={value}>
      {children}
    </LeadNavigationStateContext.Provider>
  );
}
