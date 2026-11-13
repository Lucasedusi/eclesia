export function financeTransactionStatusLabel(status: string) {
  return ({
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    DRAFT: "Rascunho",
    REVERSED: "Estornado",
  })[status] ?? "Não confirmado";
}
