export const EVENT_TYPES = [
  ["CONFERENCE", "Conferência"], ["CAMP", "Acampamento"], ["RETREAT", "Retiro"],
  ["COURSE", "Curso"], ["MEETING", "Reunião"], ["SERVICE", "Culto"],
  ["CONGRESS", "Congresso"], ["TRAINING", "Treinamento"], ["DINNER", "Jantar"],
  ["SYMPOSIUM", "Simpósio"], ["OTHER", "Outro"],
] as const;

export const EVENT_STATUSES = [
  ["DRAFT", "Rascunho"], ["PUBLISHED", "Publicado"],
  ["IN_PROGRESS", "Em andamento"], ["FINISHED", "Finalizado"], ["CANCELLED", "Cancelado"],
] as const;

export const EVENT_REGISTRATION_STATUSES = [["OPEN", "Inscrições abertas"], ["CLOSED", "Inscrições encerradas"]] as const;

export const EVENT_VISIBILITIES = [
  ["INTERNAL", "Interno"], ["PUBLIC", "Público"], ["PRIVATE", "Privado"],
] as const;

export const EVENT_SCOPES = [
  ["CHURCH", "Igreja"], ["REGION", "Regional"],
  ["CONGREGATION", "Congregação"], ["MINISTRY", "Ministério"],
] as const;

export const REGISTRATION_MODES = [
  ["INDIVIDUAL", "Somente individual"], ["MIXED", "Individual e caravana"],
] as const;

export const PARTICIPANT_TYPES = [
  ["MEMBER", "Membro"], ["CONGREGATED", "Congregado"], ["VISITOR", "Visitante"],
  ["EXTERNAL", "Externo"], ["CHILD", "Criança"], ["WORKER", "Obreiro"], ["PASTOR", "Pastor"],
] as const;

export const PAYMENT_METHODS = [
  ["PIX", "PIX"], ["CASH", "Dinheiro"], ["CREDIT_CARD", "Cartão de crédito"],
  ["DEBIT_CARD", "Cartão de débito"],
] as const;

export const REGISTRATION_STATUSES = [
  ["PENDING", "Pendente"], ["CONFIRMED", "Confirmada"], ["CHECKED_IN", "Check-in realizado"],
  ["CANCELLED", "Cancelada"], ["EXPIRED", "Expirada"], ["NO_SHOW", "Não compareceu"],
] as const;

export const GROUP_STATUSES = [
  ["CONFIRMED", "Confirmada"], ["CANCELLED", "Cancelada"],
] as const;

export const PAYMENT_STATUSES = [
  ["NOT_REQUIRED", "Não necessário"], ["PENDING", "Pendente"], ["PARTIAL", "Parcial"],
  ["PAID", "Pago"], ["FAILED", "Falhou"], ["CANCELLED", "Cancelado"], ["REFUNDED", "Estornado"],
] as const;

export const PAYMENT_TRANSACTION_STATUSES = [
  ["PENDING", "Pendente"], ["CONFIRMED", "Confirmado"], ["FAILED", "Falhou"],
  ["CANCELLED", "Cancelado"], ["REFUNDED", "Estornado"],
] as const;

export const CHECKIN_METHODS = [
  ["QR_CODE", "QR Code"], ["SEARCH", "Busca manual"], ["MANUAL", "Manual"],
  ["IMPORT", "Importação"], ["OTHER", "Outro"],
] as const;

export const CHECKIN_STATUSES = [
  ["PENDING", "Pendente"], ["CHECKED_IN", "Check-in realizado"],
  ["CANCELLED", "Cancelado"], ["INVALID", "Inválido"],
] as const;

export const EVENT_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
export const EVENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const EVENT_BANNER_MAX_SIZE = 5 * 1024 * 1024;

export function options<T extends readonly (readonly [string, string])[]>(values: T) {
  return values.map(([value, label]) => ({ value, label }));
}

export function eventLabel(values: readonly (readonly [string, string])[], value: string) {
  const label = values.find(([key]) => key === value)?.[1];
  if (label) return label;
  console.warn("[events] enum value without a mapped label", { value });
  return value.toLocaleLowerCase("pt-BR").split("_").filter(Boolean).map((part) => `${part.charAt(0).toLocaleUpperCase("pt-BR")}${part.slice(1)}`).join(" ");
}

export function eventBadgeTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["CONFIRMED", "PAID", "CHECKED_IN", "ACTIVE"].includes(status)) return "success";
  if (["PENDING", "PARTIAL", "AWAITING_PAYMENT", "PROCESSING"].includes(status)) return "warning";
  if (["CANCELLED", "FAILED", "EXPIRED", "REJECTED", "NO_SHOW"].includes(status)) return "danger";
  return "neutral";
}
