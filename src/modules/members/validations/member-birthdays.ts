import { z } from "zod";

export function birthdaySearch(value: string) {
  const term = value.trim();
  return term.length >= 3 ? term : "";
}

const filterId = z.union([z.literal(""), z.uuid()]).default("");
export const birthdayFiltersSchema = z.strictObject({
  period: z.enum(["today", "week", "month", "all"]).default("today"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().trim().max(80).transform(birthdaySearch).default(""),
  congregationId: filterId,
  regionId: filterId,
});
export const birthdayPageSchema = birthdayFiltersSchema.extend({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});
export const birthdayReportSchema = z.strictObject({
  kind: z.literal("birthdays"), format: z.literal("pdf"), filters: birthdayFiltersSchema,
});
export type BirthdayFilters = z.infer<typeof birthdayFiltersSchema>;
export type BirthdayReportOptions = z.infer<typeof birthdayReportSchema>;
export const birthdayMonths = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type BirthdayRange = [start: number, end: number];

export function birthdayCalendar(filters: BirthdayFilters, now = new Date()) {
  const timeZone = "America/Sao_Paulo";
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "numeric", month: "numeric", year: "numeric" }).formatToParts(now);
  const part = (key: "year" | "month" | "day") => Number(parts.find((entry) => entry.type === key)!.value);
  const currentMonth = part("month");
  const month = filters.month ?? currentMonth;
  const ranges: BirthdayRange[] = [];
  let label = "Ano inteiro";

  if (filters.period === "today") {
    const today = currentMonth * 100 + part("day");
    ranges.push([today, today]);
    label = new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "long" }).format(now);
  } else if (filters.period === "month") {
    ranges.push([month * 100 + 1, month * 100 + 31]);
    label = birthdayMonths[month - 1];
  } else if (filters.period === "week") {
    // Use UTC arithmetic on the local civil date so the host timezone cannot shift the week.
    const sunday = new Date(Date.UTC(part("year"), currentMonth - 1, part("day")));
    sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
    const date = new Date(sunday);
    for (let offset = 0; offset < 7; offset++) {
      if (offset > 0) date.setUTCDate(date.getUTCDate() + 1);
      const day = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
      const last = ranges.at(-1);
      if (last && day === last[1] + 1) last[1] = day;
      else ranges.push([day, day]);
    }
    const display = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
    label = `${display.format(sunday)} a ${display.format(date)}`;
  }
  return { month, ranges, label };
}

export function birthdayHref(filters: BirthdayFilters, page = 1) {
  const query = new URLSearchParams();
  if (filters.period !== "today") query.set("period", filters.period);
  if (filters.period === "month" && filters.month) query.set("month", String(filters.month));
  if (filters.search) query.set("search", filters.search);
  if (filters.regionId) query.set("regionId", filters.regionId);
  if (filters.congregationId) query.set("congregationId", filters.congregationId);
  if (page > 1) query.set("page", String(page));
  return `/membros/aniversariantes${query.size ? `?${query}` : ""}`;
}
