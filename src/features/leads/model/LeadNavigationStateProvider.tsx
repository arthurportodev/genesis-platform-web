import { useCallback, useMemo, useState, type ReactNode } from "react";

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
  const [creationNotice, setCreationNotice] = useState<
    | import("@/features/leads/model/lead-navigation-state").LeadCreationNotice
    | null
  >(null);
  const markDetailOrigin = useCallback(
    (origin: LeadDetailOrigin, scrollY = 0) => {
      setDetailOrigin(origin);
      setReturnScrollY(Math.max(0, scrollY));
    },
    [],
  );
  const clearDetailOrigin = useCallback(() => {
    setDetailOrigin(null);
    setReturnScrollY(0);
  }, []);
  const clearCreationNotice = useCallback(() => setCreationNotice(null), []);
  const value = useMemo(
    () => ({
      detailOrigin,
      returnScrollY,
      creationNotice,
      markDetailOrigin,
      clearDetailOrigin,
      setCreationNotice,
      clearCreationNotice,
    }),
    [
      clearCreationNotice,
      clearDetailOrigin,
      creationNotice,
      detailOrigin,
      markDetailOrigin,
      returnScrollY,
    ],
  );
  return (
    <LeadNavigationStateContext.Provider value={value}>
      {children}
    </LeadNavigationStateContext.Provider>
  );
}
