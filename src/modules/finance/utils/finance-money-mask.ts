/** Keeps a decimal draft while grouping thousands; never uses floating point. */
export function maskCurrencyInput(value: string, signed = false): string {
  const text = value.replace(/R\$/gi, "").trim();
  const negative = signed && text.startsWith("-");
  const clean = text.replace(/[^\d,]/g, "");
  if (!clean) return negative ? "-" : "";
  const [whole, ...parts] = clean.split(",");
  const integer = (whole || "0").replace(/^0+(?=\d)/, "");
  return `${negative ? "-" : ""}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${parts.length ? `,${parts.join("").slice(0, 2)}` : ""}`;
}
export function formatCurrencyInput(value: string, signed = false): string {
  const draft = maskCurrencyInput(value, signed);
  if (!draft || draft === "-") return draft;
  const [whole, fraction = ""] = draft.split(",");
  return `${whole},${fraction.padEnd(2, "0")}`;
}
