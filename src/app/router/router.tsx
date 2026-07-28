import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";

import { AccessDeniedPage } from "@/features/errors/AccessDeniedPage";
import { NotFoundPage } from "@/features/errors/NotFoundPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { SelectOrganizationPage } from "@/features/organizations/SelectOrganizationPage";
import { AdminShell } from "@/features/admin/AdminShell";
import { OverviewPage } from "@/features/dashboard/OverviewPage";
import { LeadsPage } from "@/features/leads/LeadsPage";
import { LeadDetailPage } from "@/features/leads/LeadDetailPage";
import { PipelinePage } from "@/features/pipeline/PipelinePage";
import { FollowUpPage } from "@/features/follow-up/FollowUpPage";
import { MetricsPage } from "@/features/metrics/MetricsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const selectOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/select-organization",
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
  component: AdminShell,
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
