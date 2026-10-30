import { isLocalDate } from "./finance-period";

export function canManagePayables(auth: {
  profile: { status: string }; access: { status: string; role: string; scope: string }; permissions: string[];
}) {
  return auth.profile.status === "ACTIVE" && auth.access.status === "ACTIVE" &&
    auth.access.role === "ADMIN" && auth.access.scope === "CHURCH" &&
    auth.permissions.includes("finance.payables.manage");
}
export function payableStatus(status: string, dueDate: string, today: string) {
  return status === "PAID" ? "PAID" : dueDate < today ? "OVERDUE" : dueDate === today ? "TODAY" : "PENDING";
}
export const payableStatusLabels = { PAID: "Paga", OVERDUE: "Em atraso", TODAY: "Vence hoje", PENDING: "A vencer" };
export function nextPayableDate(date: string) {
  if (!isLocalDate(date)) throw new Error("INVALID_INPUT");
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + 1, 0));
  last.setUTCDate(Math.min(day, last.getUTCDate()));
  return last.toISOString().slice(0, 10);
}
export function shiftPayableDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
