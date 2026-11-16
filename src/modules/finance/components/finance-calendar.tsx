"use client";

import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { useFinanceDesktop } from "../hooks/use-finance-desktop";
import { isLocalDate, todayLocal } from "../utils/finance-period";
import styles from "./finance-pickers.module.css";

type Props =
  | { mode: "single"; value: string; onChange: (date: string) => void }
  | {
      mode: "range";
      initialMonth?: string;
      from: string;
      to: string;
      onChange: (from: string, to: string) => void;
    };

function asDate(value: string) {
  return isLocalDate(value) ? new Date(value + "T12:00:00") : undefined;
}
function civil(date?: Date) {
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });
export default function FinanceCalendar(props: Props) {
  const desktop = useFinanceDesktop();
  const today = asDate(todayLocal());
  const first = asDate(props.mode === "single" ? props.value : props.from);
  const options = {
    locale: ptBR,
    today,
    defaultMonth:
      (props.mode === "range" && props.initialMonth
        ? asDate(props.initialMonth + "-01")
        : first) ?? today,
    startMonth: new Date(2000, 0),
    endMonth: new Date(2099, 11),
    className: styles.calendar,
    labels: {
      labelPrevious: () => "Mês anterior",
      labelNext: () => "Próximo mês",
      labelDayButton: (day: Date, modifiers: Record<string, boolean>) =>
        [
          fullDate.format(day),
          modifiers.today && "hoje",
          modifiers.selected && "selecionado",
        ]
          .filter(Boolean)
          .join(", "),
    },
  };
  if (props.mode === "single")
    return (
      <DayPicker
        {...options}
        mode="single"
        required
        autoFocus
        selected={first}
        onSelect={(day) => props.onChange(civil(day))}
      />
    );
  return (
    <DayPicker
      {...options}
      mode="range"
      required
      resetOnSelect
      numberOfMonths={desktop ? 2 : 1}
      selected={first ? { from: first, to: asDate(props.to) } : undefined}
      onSelect={(range) => props.onChange(civil(range?.from), civil(range?.to))}
    />
  );
}
