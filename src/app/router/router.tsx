/* TanStack Router usa objetos Redirect lançados para interromper beforeLoad. */
/* eslint-disable @typescript-eslint/only-throw-error */
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";

import { AccessDeniedPage } from "@/features/errors/AccessDeniedPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { SelectOrganizationPage } from "@/features/organizations/SelectOrganizationPage";
import { OverviewPage } from "@/features/dashboard/OverviewPage";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { LeadDetailPage } from "@/features/leads/LeadDetailPage";
import { PipelinePage } from "@/features/pipeline/PipelinePage";
import { FollowUpPage } from "@/features/follow-up/FollowUpPage";
import { MetricsPage } from "@/features/metrics/MetricsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import {
  isAuthenticatedState,
  type SessionState,
} from "@/features/auth/session/session-machine";
import type { SessionCoordinator } from "@/features/auth/session/session-coordinator";
import { safeReturnTo } from "@/shared/lib/safe-return-to";
import { ProtectedAdminRoute } from "@/app/router/ProtectedAdminRoute";

export interface AppRouterContext {
  session: SessionCoordinator;
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

async function resolvedState(
  session: SessionCoordinator,
): Promise<SessionState> {
  await session.initialize();
  return session.getSnapshot();
}

function protectedReturnTo(location: {
  pathname: string;
  searchStr: string;
}): string {
  return safeReturnTo(`${location.pathname}${location.searchStr}`) ?? "/app";
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturnTo(search.returnTo),
  }),
  beforeLoad: async ({ context }) => {
    const state = await resolvedState(context.session);
    if (isAuthenticatedState(state)) {
      throw redirect({
        to: state.activeOrganization ? "/app" : "/select-organization",
        replace: true,
      });
    }
  },
  component: LoginPage,
});

const selectOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/select-organization",
  beforeLoad: async ({ context }) => {
    const state = await resolvedState(context.session);
    if (state.status === "anonymous" || state.status === "session-expired") {
      throw redirect({
        to: "/login",
        search: { returnTo: undefined },
        replace: true,
      });
    }
    if (isAuthenticatedState(state) && state.activeOrganization) {
      throw redirect({ to: "/app", replace: true });
    }
  },
  component: SelectOrganizationPage,
});

const accessDeniedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/access-denied",
  component: AccessDeniedPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: async ({ context, location }) => {
    const state = await resolvedState(context.session);
    if (state.status === "anonymous" || state.status === "session-expired") {
      throw redirect({
        to: "/login",
        search: { returnTo: protectedReturnTo(location) },
        replace: true,
      });
    }
    if (
      state.status === "authenticated-without-organization" ||
      (isAuthenticatedState(state) && !state.activeOrganization)
    ) {
      throw redirect({ to: "/select-organization", replace: true });
    }
    if (state.status === "access-denied") {
      throw redirect({ to: "/access-denied", replace: true });
    }
  },
  component: ProtectedAdminRoute,
  notFoundComponent: NotFoundPage,
});

const overviewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: OverviewPage,
});

const leadsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/leads",
  component: LeadsPage,
});

const leadDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/leads/$leadId",
  component: LeadDetailPage,
});

const pipelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/pipeline",
  component: PipelinePage,
});

const followUpRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/follow-up",
  component: FollowUpPage,
});

const metricsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/metrics",
  component: MetricsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const appChildren = [
  overviewRoute,
  leadsRoute,
  leadDetailRoute,
  pipelineRoute,
  followUpRoute,
  metricsRoute,
  settingsRoute,
];

const routeTree = rootRoute.addChildren([
  loginRoute,
  selectOrganizationRoute,
  accessDeniedRoute,
  appRoute.addChildren(appChildren),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { session: undefined as unknown as SessionCoordinator },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
