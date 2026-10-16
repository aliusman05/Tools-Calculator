import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./Field";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function Textarea({ id, label, hint, error, className, ...props }: Props) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        className={cn(controlClasses, "min-h-36 py-2", error && "border-danger", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </Field>
  );
}
