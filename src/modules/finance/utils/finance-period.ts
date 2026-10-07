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
