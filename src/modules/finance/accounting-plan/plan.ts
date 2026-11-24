import { z } from "zod";
import { normalizeCategoryName as normalize } from "../utils/finance-category-name";

export const accountCode = z.string().regex(/^\d{1,32}$/);
export const accountSchema = z.object({
  code: accountCode,
  classification: z
    .string()
    .max(100)
    .regex(/^\d+(?:\.\d+)*$/),
  name: z.string().trim().min(1).max(250),
});
export const accountsSchema = z
  .array(accountSchema)
  .max(4000)
  .refine((rows) => new Set(rows.map((r) => r.code)).size === rows.length);
export const linkSchema = z.object({
  category: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  direction: z.enum(["INCOME", "EXPENSE"]),
  code: accountCode.nullable(),
});
export type Account = z.infer<typeof accountSchema>;
export type EntryLink = z.infer<typeof linkSchema>;
export type Category = {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE" | "BOTH";
  income: string | null;
  expense: string | null;
  legacy: string | null;
};
export type PlanState = {
  accounts: Account[];
  categories: Category[];
  revision: string;
};
export function reviewAccounts(current: Account[], proposed: Account[]) {
  const byCode = new Map(current.map((row) => [row.code, row]));
  return proposed.filter((row) => {
    const old = byCode.get(row.code);
    return old?.classification !== row.classification || old.name !== row.name;
  });
}
export function postingAccounts(rows: Account[]) {
  const parents = new Set<string>();
  for (const row of rows) {
    const segments = row.classification.split(".");
    while (segments.length > 1) {
      segments.pop();
      parents.add(segments.join("."));
    }
  }
  return rows.filter((row) => !parents.has(row.classification));
}
export function categoryCode(
  category: Category,
  direction: EntryLink["direction"],
) {
  return direction === "INCOME" ? category.income : category.expense;
}

export type DraftLink = {
  name: string;
  direction: EntryLink["direction"];
  code: string;
  create: boolean;
  selected: boolean;
};
export function suggestLinks(
  categories: Category[],
  accounts: Account[],
): DraftLink[] {
  const result: DraftLink[] = [];
  const choices = postingAccounts(accounts);
  for (const category of categories) {
    for (const direction of ["INCOME", "EXPENSE"] as const) {
      if (category.direction !== "BOTH" && category.direction !== direction)
        continue;
      if (categoryCode(category, direction)) continue;
      let name = normalize(category.name);
      if (name === "repasse")
        name =
          direction === "INCOME"
            ? "repasse congregacoes"
            : "repasse a catedral";
      const matches = choices.filter((a) => normalize(a.name) === name);
      if (matches.length === 1)
        result.push({
          name: category.name,
          direction,
          code: matches[0].code,
          selected: true,
          create: false,
        });
    }
  }
  return result;
}

// Accept copied spreadsheet cells, including the reviewed Categorias worksheet.
export function readMappingCells(text: string): DraftLink[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length > 2001 || text.length > 1000000)
    throw new Error("Cole até 2.000 linhas por vez.");
  const cells = lines.map((line) =>
    line.split(line.includes("\t") ? "\t" : ";").map((value) => value.trim()),
  );
  const header = (cells[0] ?? []).map(normalize);
  const worksheet =
    header.includes("nome no plano antigo") &&
    header.includes("codigo alterdata");
  const result = new Map<string, DraftLink>();
  for (const [index, row] of cells.entries()) {
    if (index === 0 && (worksheet || header[0] === "categoria")) continue;
    const get = (label: string) => row[header.indexOf(label)] ?? "";
    const [name, movement, code] = worksheet
      ? [
          get("cadastro no eclesias") || get("nome no plano antigo"),
          get("movimento"),
          get("codigo vigente confirmado") || get("codigo alterdata"),
        ]
      : row;
    if (worksheet && !/^\d+$/.test(code || "")) continue;
    const direction =
      normalize(movement ?? "") === "entrada"
        ? "INCOME"
        : normalize(movement ?? "") === "saida"
          ? "EXPENSE"
          : null;
    if (
      !direction ||
      !name ||
      !accountCode.safeParse(code).success ||
      (!worksheet && row.length !== 3)
    )
      throw new Error(
        `Confira a linha ${index + 1}. Use categoria, movimento e chamada.`,
      );
    result.set(JSON.stringify([name, direction, code]), {
      name,
      direction,
      code,
      selected: false,
      create: false,
    });
  }
  if (!result.size)
    throw new Error(
      "Nenhuma linha com categoria, movimento e chamada foi encontrada.",
    );
  return [...result.values()];
}
export function reviewLinks(
  drafts: DraftLink[],
  categories: Category[],
  accounts: Account[],
) {
  const usable = new Set(postingAccounts(accounts).map((a) => a.code));
  const changes: EntryLink[] = [];
  const seen = new Set<string>();
  for (const draft of drafts.filter((row) => row.selected)) {
    const matches = categories.filter(
      (c) => normalize(c.name) === normalize(draft.name),
    );
    const category =
      matches.find((c) => c.name === draft.name) ??
      (matches.length === 1 ? matches[0] : null);
    if (!category && (!draft.create || matches.length || !draft.name.trim()))
      throw new Error(
        `Escolha a categoria do Eclesias ou confirme sua criação: ${draft.name || "linha sem nome"}.`,
      );
    if (
      category &&
      category.direction !== "BOTH" &&
      category.direction !== draft.direction
    )
      throw new Error(`Confira o movimento de ${category.name}.`);
    if ((draft.code && !usable.has(draft.code)) || (!category && !draft.code))
      throw new Error(
        `Escolha uma conta analítica do plano para ${draft.name}.`,
      );
    const key = JSON.stringify([
      category?.id ?? normalize(draft.name),
      category ? draft.direction : "NEW",
    ]);
    if (seen.has(key))
      throw new Error(`Revise as linhas repetidas de ${draft.name}.`);
    seen.add(key);
    const code = draft.code || null;
    if (category && categoryCode(category, draft.direction) === code) continue;
    const parsed = linkSchema.safeParse({
      category: category?.id ?? null,
      name: category?.name ?? draft.name,
      direction: draft.direction,
      code,
    });
    if (!parsed.success)
      throw new Error("Confira o nome e o código da categoria.");
    changes.push(parsed.data);
  }
  return changes;
}
