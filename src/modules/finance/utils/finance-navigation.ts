export function financeLocation(
  path: string,
  unit: string,
  month: string,
  extras: Record<string, string> = {},
) {
  if (!path.startsWith("/financeiro")) return path;
  const url = new URL(path, "http://finance.local");
  if (url.pathname !== "/financeiro" && !url.pathname.startsWith("/financeiro/"))
    return path;
  for (const [key, value] of Object.entries(extras))
    if (key !== "unidade" && key !== "mes") url.searchParams.set(key, value);
  url.searchParams.set("unidade", unit);
  url.searchParams.set("mes", month);
  return `${url.pathname}${url.search}${url.hash}`;
}
