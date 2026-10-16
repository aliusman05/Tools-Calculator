"use client";

import { NumericInput, type NumericInputProps } from "./NumericInput";

type Props = Omit<NumericInputProps, "prefix" | "suffix" | "grouping"> & {
  /** Symbol shown inside the field. Defaults to "$". */
  symbol?: string;
};

export function CurrencyInput({ symbol = "$", ...props }: Props) {
  return <NumericInput prefix={symbol} grouping {...props} />;
}
