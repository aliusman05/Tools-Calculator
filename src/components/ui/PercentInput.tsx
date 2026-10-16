"use client";

import { NumericInput, type NumericInputProps } from "./NumericInput";

export function PercentInput(props: Omit<NumericInputProps, "prefix" | "suffix" | "grouping">) {
  return <NumericInput suffix="%" grouping={false} {...props} />;
}
