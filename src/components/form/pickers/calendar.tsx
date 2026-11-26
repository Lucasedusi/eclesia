"use client";

import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { useWideCalendar } from "./use-wide-calendar";
import { isCivilDate, todayLocal } from "@/utils/civil-date";
import styles from "./pickers.module.css";

type Props =
  | { mode: "single"; value: string; min?: string; max?: string; onChange: (date: string) => void }
  | {
      mode: "range";
      initialMonth?: string;
      from: string;
      to: string;
      onChange: (from: string, to: string) => void;
    };

function asDate(value: string) {
  return isCivilDate(value) ? new Date(value + "T12:00:00") : undefined;
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
export default function Calendar(props: Props) {
  const desktop = useWideCalendar();
  const today = asDate(todayLocal());
  const first = asDate(props.mode === "single" ? props.value : props.from);
  const min = props.mode === "single" ? props.min ?? "2000-01-01" : "2000-01-01";
  const max = props.mode === "single" ? props.max ?? "2099-12-31" : "2099-12-31";
  const earliest = asDate(min)!;
  const latest = asDate(max)!;
  const initial = (props.mode === "range" && props.initialMonth ? asDate(props.initialMonth + "-01") : first) ?? today!;
  const options = {
    locale: ptBR,
    today,
    defaultMonth: initial < earliest ? earliest : initial > latest ? latest : initial,
    startMonth: earliest, endMonth: latest,
    disabled: [{before: earliest}, {after: latest}],
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
