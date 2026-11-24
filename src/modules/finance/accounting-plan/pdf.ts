import "server-only";
import { getDocumentProxy } from "unpdf";
import { accountsSchema, type Account } from "./plan";

type Cell = { x: number; y: number; text: string };
const invalid = () => new Error("ACCOUNTING_PLAN_FILE");

export async function parseChartPdf(bytes: Uint8Array): Promise<Account[]> {
  if (
    bytes.length > 5 * 1024 * 1024 ||
    Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw invalid();
  const doc = await getDocumentProxy(bytes);
  try {
    if (doc.numPages > 100) throw invalid();
    const accounts: Account[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const cells: Cell[] = [];
      for (const item of items) {
        if ("str" in item && item.str.trim())
          cells.push({
            x: item.transform[4],
            y: item.transform[5],
            text: item.str.trim(),
          });
      }
      const lines: Cell[][] = [];
      for (const cell of cells.sort((a, b) => b.y - a.y)) {
        const last = lines.at(-1);
        if (last && last[0].y - cell.y <= 3) last.push(cell);
        else lines.push([cell]);
      }
      let inTable = false;
      for (const line of lines) {
        const values = line.sort((a, b) => a.x - b.x).map((c) => c.text);
        if (!inTable) {
          inTable =
            values.join(" ").toLocaleLowerCase("pt-BR") ===
            "classificação nome da conta chamada";
          continue;
        }
        if (values.length < 3 || accounts.length >= 4000) throw invalid();
        accounts.push({
          classification: values[0],
          name: values.slice(1, -1).join(" "),
          code: values.at(-1)!,
        });
      }
      if (!inTable) throw invalid();
      page.cleanup();
    }
    const result = accountsSchema.safeParse(accounts);
    if (!result.success || !result.data.length) throw invalid();
    return result.data;
  } finally {
    await doc.loadingTask.destroy();
  }
}
