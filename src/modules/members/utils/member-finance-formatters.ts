export const financeDirectionLabel = (value: string) =>
  ({ INCOME: "Entrada", EXPENSE: "Saída" })[value] ?? "Não informado";
export const financeStatusLabel = (value: string) =>
  ({ CONFIRMED: "Confirmado", CANCELLED: "Cancelado", PENDING: "Pendente" })[
    value
  ] ?? "Não confirmado";
export const formatMemberMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
