"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { groupThousands, parseDisplayNumber, sanitizeNumeric } from "@/lib/input-format";
import { controlClasses, describedBy, Field } from "./Field";

export type NumericInputProps = {
  id: string;
  label: string;
  /** null means empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  /** Show thousands separators (default true). */
  grouping?: boolean;
  placeholder?: string;
  className?: string;
};

function toDisplay(value: number | null, grouping: boolean): string {
  if (value === null || Number.isNaN(value)) return "";
  const s = String(value);
  return grouping ? groupThousands(s) : s;
}

/** Text input that accepts only digits and one decimal point, with optional prefix/suffix adornment. */
export function NumericInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  error,
  grouping = true,
  placeholder,
  className,
}: NumericInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value, grouping));

  // Resync when the parent changes the value (for example, a paired slider moved).
  const parsed = parseDisplayNumber(display);
  const current = Number.isNaN(parsed) ? null : parsed;
  if (current !== value) {
    setDisplay(toDisplay(value, grouping));
  }

  function handleChange(raw: string) {
    const clean = sanitizeNumeric(raw);
    setDisplay(grouping ? groupThousands(clean) : clean);
    const n = parseDisplayNumber(clean);
    onChange(Number.isNaN(n) ? null : n);
  }

  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute inset-y-0 left-3 flex items-center"
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(
            controlClasses,
            prefix && "pl-8",
            suffix && "pr-10",
            error && "border-danger",
          )}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center"
          >
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}
