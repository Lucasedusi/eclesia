import { FinanceReportError } from "../types/finance-report.types";
export function deliveryTimeliness(
  date: string | null,
  due: string,
  today: string,
) {
  return date
    ? date <= due
      ? "No prazo"
      : "Com atraso"
    : today <= due
      ? "Aguardando entrega"
      : "Em atraso";
}
export function sumCents(values: number[]) {
  const sum = values.reduce((a, b) => a + BigInt(b), BigInt(0));
  if (
    sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new FinanceReportError("REPORT_TOO_LARGE");
  return Number(sum);
}
export type RankingAmounts = {
  incomeCents: number;
  expenseCents: number;
  closingCents: number;
  grossPrebendCents: number;
  transferCents: number;
  missingMonths: number;
};
export function summarizeRanking<
  T extends RankingAmounts & { id: string; name: string },
>(input: T[]) {
  const rows = [...input].sort(
    (a, b) =>
      b.incomeCents - a.incomeCents ||
      a.name.localeCompare(b.name, "pt-BR") ||
      a.id.localeCompare(b.id),
  );
  const totals: RankingAmounts = {
    incomeCents: 0,
    expenseCents: 0,
    closingCents: 0,
    grossPrebendCents: 0,
    transferCents: 0,
    missingMonths: 0,
  };
  for (const key of Object.keys(totals) as (keyof RankingAmounts)[])
    totals[key] = sumCents(rows.map((r) => r[key]));
  return { rows, totals };
}
