export const EVENT_TYPES = [
  ["CONFERENCE", "Conferência"], ["CAMP", "Acampamento"], ["RETREAT", "Retiro"],
  ["COURSE", "Curso"], ["MEETING", "Reunião"], ["SERVICE", "Culto"],
  ["CONGRESS", "Congresso"], ["TRAINING", "Treinamento"], ["DINNER", "Jantar"],
  ["SYMPOSIUM", "Simpósio"], ["OTHER", "Outro"],
] as const;

export const EVENT_STATUSES = [
  ["DRAFT", "Rascunho"], ["PUBLISHED", "Publicado"],
  ["REGISTRATION_OPEN", "Inscrições abertas"], ["REGISTRATION_CLOSED", "Inscrições encerradas"],
  ["IN_PROGRESS", "Em andamento"], ["FINISHED", "Finalizado"], ["CANCELLED", "Cancelado"],
] as const;

export const EVENT_VISIBILITIES = [
  ["INTERNAL", "Interno"], ["PUBLIC", "Público"], ["PRIVATE", "Privado"],
] as const;

export const EVENT_SCOPES = [
  ["CHURCH", "Igreja"], ["REGION", "Regional"],
  ["CONGREGATION", "Congregação"], ["MINISTRY", "Ministério"],
] as const;

export const REGISTRATION_MODES = [
  ["INDIVIDUAL", "Individual"], ["GROUP", "Grupo/caravana"], ["MIXED", "Misto"],
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

export const PAYMENT_STATUSES = [
  ["NOT_REQUIRED", "Não necessário"], ["PENDING", "Pendente"], ["PARTIAL", "Parcial"],
  ["PAID", "Pago"], ["FAILED", "Falhou"], ["CANCELLED", "Cancelado"], ["REFUNDED", "Estornado"],
] as const;

export const EVENT_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
export const EVENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const EVENT_BANNER_MAX_SIZE = 5 * 1024 * 1024;

export function options<T extends readonly (readonly [string, string])[]>(values: T) {
  return values.map(([value, label]) => ({ value, label }));
}

export function eventLabel(values: readonly (readonly [string, string])[], value: string) {
  return values.find(([key]) => key === value)?.[1] ?? value;
}
