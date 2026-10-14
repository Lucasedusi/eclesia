/** Digit entry is in cents. String arithmetic keeps large amounts exact. */
export function maskCurrencyInput(value: string, signed = false): string {
  const text = value.replace(/R\$/gi, "").trim();
  const negative = signed && text.startsWith("-");
  const digits = text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return negative ? "-" : "";
  const padded = digits.padStart(3, "0");
  return `${negative ? "-" : ""}${padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${padded.slice(-2)}`;
}
/** Loaded values and blur already represent reais, rather than digit entry. */
export function formatCurrencyInput(value: string, signed = false): string {
  const text = value.replace(/R\$/gi, "").trim();
  const negative = signed && text.startsWith("-");
  const clean = text.replace(/[^\d,]/g, "");
  if (!clean) return negative ? "-" : "";
  const [whole, fraction = ""] = clean.split(",");
  return maskCurrencyInput(`${negative ? "-" : ""}${whole || "0"}${fraction.slice(0, 2).padEnd(2, "0")}`, signed);
}
/** Preserve the magnitude of a formatted pasted amount, including decimal dots. */
export function formatPastedCurrency(value: string, signed = false): string {
  if (value.includes(",")) return formatCurrencyInput(value, signed);
  if (/\.\d{1,2}$/.test(value.trim()))
    return formatCurrencyInput(value.replace(/\.(?=\d{1,2}\s*$)/, ","), signed);
  return maskCurrencyInput(value, signed);
}
