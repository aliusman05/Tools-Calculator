import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./Field";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  id: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
  error?: string;
};

export function Select({ id, label, options, hint, error, className, ...props }: Props) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={cn(controlClasses, error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
