"use client";

import type { ComponentProps } from "react";
import { PickerSelect } from "@/components/form/pickers/picker-select";

export function FinanceSelect(props: ComponentProps<typeof PickerSelect> & { label: string }) {
  return <PickerSelect {...props} tone="finance" />;
}
