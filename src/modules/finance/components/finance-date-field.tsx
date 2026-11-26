"use client";

import type { ComponentProps } from "react";
import { DateField } from "@/components/form/pickers/date-field";
export { Calendar as FinanceCalendar } from "@/components/form/pickers/date-field";

export function FinanceDateField(props: ComponentProps<typeof DateField>) {
  return <DateField {...props} tone="finance" />;
}
