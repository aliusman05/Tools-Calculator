import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./Field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ id, label, hint, error, className, ...props }: Props) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={cn(controlClasses, error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Field>
  );
}
