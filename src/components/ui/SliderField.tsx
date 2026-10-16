"use client";

import { NumericInput } from "./NumericInput";

type Props = {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  grouping?: boolean;
  hint?: string;
  error?: string;
};

/** A numeric input with a slider bound to the same value. */
export function SliderField({ id, min, max, step = 1, value, onChange, label, ...rest }: Props) {
  const sliderValue = Math.min(max, Math.max(min, value ?? min));
  return (
    <div className="flex flex-col gap-2">
      <NumericInput id={id} label={label} value={value} onChange={onChange} {...rest} />
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent h-6 w-full cursor-pointer"
      />
    </div>
  );
}
