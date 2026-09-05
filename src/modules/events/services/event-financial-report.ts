import { PAYMENT_METHODS } from "../constants/events";
import type {
  EventFinancialItemRow,
  EventFinancialItemSource,
  EventFinancialExpenseRow,
  EventFinancialExpenseSource,
  EventFinancialPaymentMethodRow,
  EventFinancialPaymentSource,
  EventFinancialRegistrationSource,
  EventFinancialReportConfig,
} from "../types/event.types";

const paymentMethodLabels = new Map<string, string>([
  ...PAYMENT_METHODS,
  ["BANK_TRANSFER", "Transferência bancária"] as const,
  ["BANK_SLIP", "Boleto bancário"] as const,
  ["OTHER", "Outro"] as const,
]);

function compareNames(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
}

function sortPaymentMethods(rows: EventFinancialPaymentMethodRow[], organization: EventFinancialReportConfig["organization"]) {
  return [...rows].sort((left, right) => {
    if (organization === "HIGHEST_VALUE") return right.amountReceived - left.amountReceived || compareNames(left.name, right.name);
    if (organization === "HIGHEST_QUANTITY") return right.confirmedPaymentCount - left.confirmedPaymentCount || compareNames(left.name, right.name);
    return compareNames(left.name, right.name);
  });
}

function sortItems(rows: EventFinancialItemRow[], organization: EventFinancialReportConfig["organization"]) {
  return [...rows].sort((left, right) => {
    if (organization === "HIGHEST_VALUE") return right.expectedAmount - left.expectedAmount || compareNames(left.name, right.name);
    if (organization === "HIGHEST_QUANTITY") return right.units - left.units || compareNames(left.name, right.name);
    return compareNames(left.name, right.name);
  });
}

function sortExpenses(rows: EventFinancialExpenseSource[], organization: EventFinancialReportConfig["expenseOrganization"]): EventFinancialExpenseRow[] {
  const sorted = [...rows].sort((left, right) => {
    if (organization === "HIGHEST_VALUE") return right.amount - left.amount || compareNames(left.name, right.name);
    if (organization === "ALPHABETICAL") return compareNames(left.name, right.name) || right.expenseDate.localeCompare(left.expenseDate);
    return right.expenseDate.localeCompare(left.expenseDate) || compareNames(left.name, right.name);
  });
  return sorted.map((row, index) => ({ ...row, index: index + 1 }));
}

export function aggregateEventFinancialReport(input: {
  config: EventFinancialReportConfig;
  registrations: EventFinancialRegistrationSource[];
  payments: EventFinancialPaymentSource[];
  items: EventFinancialItemSource[];
  expenses: EventFinancialExpenseSource[];
}) {
  const includesEntries = input.config.scope !== "EXPENSES_ONLY" || input.config.sections.showPaymentMethods || input.config.sections.showItems;
  const includesExpenses = input.config.scope !== "ENTRIES_ONLY" || input.config.sections.showExpenses;
  const confirmedPayments = (includesEntries ? input.payments : []).filter((payment) => (
    payment.status === "CONFIRMED"
    && (!input.config.filters.paymentMethod || payment.method === input.config.filters.paymentMethod)
  ));
  const totalReceived = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const paymentMethodsById = new Map<string, EventFinancialPaymentMethodRow>();
  confirmedPayments.forEach((payment) => {
    const current = paymentMethodsById.get(payment.method) ?? {
      id: payment.method,
      name: paymentMethodLabels.get(payment.method) ?? payment.method,
      confirmedPaymentCount: 0,
      amountReceived: 0,
      percentage: 0,
    };
    current.confirmedPaymentCount += 1;
    current.amountReceived += payment.amount;
    paymentMethodsById.set(payment.method, current);
  });
  const paymentMethods = sortPaymentMethods(
    [...paymentMethodsById.values()].map((row) => ({
      ...row,
      percentage: totalReceived > 0 ? (row.amountReceived / totalReceived) * 100 : 0,
    })),
    input.config.organization,
  );

  const itemAccumulators = new Map<string, EventFinancialItemRow & { participantIds: Set<string>; caravanParticipants:number }>();
  (includesEntries ? input.items : []).forEach((item) => {
    const current = itemAccumulators.get(item.itemId) ?? {
      id: item.itemId,
      name: item.itemName,
      participantCount: 0,
      participantIds: new Set<string>(),
      caravanParticipants:0,
      units: 0,
      expectedAmount: 0,
    };
    if (item.registrationId) current.participantIds.add(item.registrationId);
    if(item.groupId)current.caravanParticipants+=item.quantity;
    current.units += item.quantity;
    current.expectedAmount += item.expectedAmount;
    itemAccumulators.set(item.itemId, current);
  });
  const items = sortItems(
    [...itemAccumulators.values()].map(({ participantIds,caravanParticipants, ...row }) => ({
      ...row,
      participantCount: participantIds.size+caravanParticipants,
    })),
    input.config.organization,
  );
  const expenses = sortExpenses(includesExpenses ? input.expenses : [], input.config.expenseOrganization);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    totalReceived,
    totalExpenses,
    balance: totalReceived - totalExpenses,
    expectedAmount: (includesEntries ? input.registrations : []).reduce((sum, registration) => sum + registration.totalAmount, 0),
    pendingAmount: (includesEntries ? input.registrations : []).reduce((sum, registration) => sum + Math.max(0, registration.remainingAmount), 0),
    paidRegistrationCount: (includesEntries ? input.registrations : []).filter((registration) => registration.paymentStatus === "PAID").length,
    paymentMethods,
    items,
    expenses,
    totalItemUnits: items.reduce((sum, item) => sum + item.units, 0),
  };
}
