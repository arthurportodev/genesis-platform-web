import {
  BarChart3,
  Columns3,
  LayoutDashboard,
  ListTodo,
  Settings,
  UserRoundSearch,
} from "lucide-react";

export const adminNavigation = [
  { label: "Visão geral", to: "/app", icon: LayoutDashboard, exact: true },
  { label: "Leads", to: "/app/leads", icon: UserRoundSearch },
  { label: "Pipeline", to: "/app/pipeline", icon: Columns3 },
  { label: "Follow-up", to: "/app/follow-up", icon: ListTodo },
  {
    label: "Métricas",
    to: "/app/metrics",
    icon: BarChart3,
    roles: ["owner", "admin"],
  },
  { label: "Configurações", to: "/app/settings", icon: Settings },
] as const;
