export const MAX_AMOUNT_CENTS = 999999999999;
export function sumCents(...values: number[]): number {
  const result = values.reduce((total, value) => {
    if (!Number.isSafeInteger(value)) throw new Error("INVALID_INPUT");
    return total + BigInt(value);
  }, BigInt(0));
  if (
    result > BigInt(Number.MAX_SAFE_INTEGER) ||
    result < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("INVALID_INPUT");
  return Number(result);
}
export function decimalToCents(value: string | number): number {
  const text = String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error("INVALID_INPUT");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const result =
    (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))) *
    (text.startsWith("-") ? -BigInt(1) : BigInt(1));
  if (
    result > BigInt(Number.MAX_SAFE_INTEGER) ||
    result < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("INVALID_INPUT");
  return Number(result);
}
export function centsToDecimal(value: number): string {
  if (!Number.isSafeInteger(value)) throw new Error("INVALID_INPUT");
  const abs = BigInt(value < 0 ? -value : value);
  return `${value < 0 ? "-" : ""}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
}
export function percentageCents(base: number, percentage: string): number {
  if (
    !Number.isSafeInteger(base) ||
    base < 0 ||
    !/^\d{1,3}(\.\d{1,4})?$/.test(percentage)
  )
    throw new Error("INVALID_INPUT");
  const [whole, fraction = ""] = percentage.split(".");
  const scaled =
    BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, "0"));
  if (scaled > BigInt(1000000)) throw new Error("INVALID_INPUT");
  return Number((BigInt(base) * scaled + BigInt(500000)) / BigInt(1000000));
}
export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseMoneyInput(value: string): number {
  const normalized = value.trim();
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized))
    throw new Error("INVALID_INPUT");
  return decimalToCents(normalized.replaceAll(".", "").replace(",", "."));
}
export const toSqlAmount = centsToDecimal;
