import { Link } from "@tanstack/react-router";

import { environment } from "@/shared/config/environment";
import { cn } from "@/shared/lib/cn";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      to="/app"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={`${environment.appName}, início`}
    >
      <span className="whitespace-nowrap text-sm font-bold tracking-tight text-foreground">
        {environment.appName}
      </span>
    </Link>
  );
}
