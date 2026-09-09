import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/Input";

export type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const VisibilityIcon = visible ? EyeOff : Eye;
    const label = visible ? "Ocultar senha" : "Mostrar senha";

    return (
      <div className="relative">
        <LockKeyhole
          className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pl-9 pr-11", className)}
        />
        <button
          type="button"
          className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={label}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <VisibilityIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";
