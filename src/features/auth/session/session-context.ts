import { createContext } from "react";

import type { SessionCoordinator } from "@/features/auth/session/session-coordinator";

export const SessionContext = createContext<SessionCoordinator | null>(null);
