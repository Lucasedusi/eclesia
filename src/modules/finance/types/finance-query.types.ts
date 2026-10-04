export type FinanceOverview = {
  openingCents: number;
  openingMovementCents: number;
  incomeCents: number;
  expenseCents: number;
  adjustmentCents: number;
  closingCents: number;
  dailySeries: { date: string; incomeCents: number; expenseCents: number }[];
  categorySeries: {
    id: string;
    name: string;
    direction: string;
    amountCents: number;
  }[];
};
export type FinanceTransactionRow = {
  id: string;
  date: string;
  direction: "INCOME" | "EXPENSE";
  amountCents: number;
  status: string;
  revision: number;
  personName: string | null;
  beneficiaryName: string | null;
  categoryName: string | null;
  departmentName: string | null;
  classificationName: string | null;
  description: string | null;
  documentNumber: string | null;
  attendanceId: string | null;
  cashboxId: string;
  paymentMethodId: string;
};
export type FinanceTransactionPage = {
  items: FinanceTransactionRow[];
  totalCount: number;
  filteredIncomeCents: number;
  filteredExpenseCents: number;
  page: number;
  pageCount: number;
};
export type FinanceTransactionDetail = FinanceTransactionRow & {
  memberId: string | null;
  contributorKind: string | null;
  categoryId: string;
  departmentId: string;
  titheClassificationId: string | null;
  notes: string | null;
  paymentReference: string | null;
  attendanceRevision: number | null;
  receipts: { id: string; number: string; revision: number; status: string }[];
  documents: { id: string; name: string }[];
  history: {
    revision: number;
    reason: string;
    createdAt: string;
    beforeAmountCents: number | null;
    afterAmountCents: number | null;
  }[];
};
