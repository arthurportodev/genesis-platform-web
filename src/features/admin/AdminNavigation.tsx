import { Link } from "@tanstack/react-router";

import { adminNavigation } from "@/features/admin/navigation";
import { cn } from "@/shared/lib/cn";

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="space-y-1">
      {adminNavigation.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item ? item.exact : false }}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
            )}
            activeProps={{
              className:
                "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              "aria-current": "page",
            }}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
