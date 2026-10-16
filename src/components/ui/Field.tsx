import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClasses =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted";

/** Label, hint and error wiring shared by every form control. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
