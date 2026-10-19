export function isLocalDate(value: string) {
  if (!/^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}
export function isMonth(value: string) {
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
export function monthOf(date: string) {
  if (!isLocalDate(date)) throw new Error("INVALID_INPUT");
  return date.slice(0, 7);
}
export function monthRange(month: string) {
  if (!isMonth(month)) throw new Error("INVALID_INPUT");
  const [year, m] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    end: `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`,
  };
}
export function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftCivilDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function recentFinanceRange(days: 3 | 7, today = todayLocal()) {
  if (!isLocalDate(today)) throw new Error("INVALID_INPUT");
  const dateFrom = shiftCivilDate(today, 1 - days);
  if (!isLocalDate(dateFrom)) throw new Error("INVALID_INPUT");
  return { dateFrom, dateTo: today };
}

export function financeQueryRange(input: { month: string; dateFrom?: string; dateTo?: string }) {
  if (input.dateFrom === undefined && input.dateTo === undefined) return monthRange(input.month);
  if (!input.dateFrom || !input.dateTo || !isLocalDate(input.dateFrom) || !isLocalDate(input.dateTo) || input.dateFrom > input.dateTo)
    throw new Error("INVALID_INPUT");
  return { start: input.dateFrom, end: shiftCivilDate(input.dateTo, 1) };
}

export function formatFinanceDateRange(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const first = (sameYear ? from.slice(5) : from).split("-").reverse().join("/");
  return `${first} a ${to.split("-").reverse().join("/")}`;
}

export function formatFinanceMonth(month: string, long = false) {
  const [year, part] = month.split("-");
  const index = Number(part) - 1;
  const names = long
    ? [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ]
    : [
        "jan",
        "fev",
        "mar",
        "abr",
        "mai",
        "jun",
        "jul",
        "ago",
        "set",
        "out",
        "nov",
        "dez",
      ];
  return index >= 0 && index < 12
    ? long
      ? `${names[index]} de ${year}`
      : `${names[index]}/${year}`
    : month;
}
