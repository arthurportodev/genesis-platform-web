import {
  AlertTriangle,
  Ban,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";

import { buttonVariants } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

type OperationalStateKind = "empty" | "loading" | "error" | "unavailable";

const stateIcons: Record<OperationalStateKind, LucideIcon> = {
  empty: Inbox,
  loading: LoaderCircle,
  error: AlertTriangle,
  unavailable: Ban,
};

interface OperationalStateProps {
  kind: OperationalStateKind;
  title: string;
  description: string;
  action?: { label: string; href: string };
  compact?: boolean;
}

export function OperationalState({
  kind,
  title,
  description,
  action,
  compact = false,
}: OperationalStateProps) {
  const Icon = stateIcons[kind];

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 text-center",
        compact ? "py-8" : "py-14",
      )}
      role={kind === "loading" ? "status" : undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
    >
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon
          className={cn("size-5", kind === "loading" && "animate-spin")}
          aria-hidden="true"
        />
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? (
        <a
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "mt-5",
          )}
          href={action.href}
        >
          {action.label}
        </a>
      ) : null}
    </section>
  );
}
