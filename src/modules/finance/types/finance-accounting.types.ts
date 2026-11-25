export type AccountingUnit = { id: string; name: string };
export type AccountingCatalog = {
  units: (AccountingUnit & { isHeadquarters?: boolean })[];
  boxes: (AccountingUnit & {
    unit: string;
    code: string | null;
    agency: string | null;
    account: string | null;
  })[];
  categories: (AccountingUnit & { direction: string; code: string | null })[];
};

export type AccountingRow = {
  id: string;
  date: string;
  unit: string;
  box: string | null;
  category: string | null;
  direction: "INCOME" | "EXPENSE";
  cents: number;
  debit: string | null;
  credit: string | null;
  classification: string | null;
  payer: string | null;
  box_issue: string | null;
  category_issue: string | null;
};
export type AccountingPreview = {
  rows: AccountingRow[];
  total: number;
  page: number;
  previous: number;
  missing: number;
  fingerprint: string;
  income: number;
  expense: number;
  special: { date: string; kind: string; quantity: number }[];
};
export type AccountingBatch = {
  id: string;
  created: string;
  confirmed: string | null;
  actor: string;
  unit: string;
  box: string;
  start: string;
  end: string;
  direction: string;
  income: number;
  expense: number;
  count: number;
  changed: number;
};
export type AccountingHistory = { total: number; items: AccountingBatch[] };
