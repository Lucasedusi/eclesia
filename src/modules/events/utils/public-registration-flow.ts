export type PublicTrackingKind = "INDIVIDUAL" | "CARAVAN";
export type PublicStatusTone = "success" | "warning" | "danger" | "neutral";
export type PublicRefreshNotice = {
  title: string;
  message: string;
  tone: PublicStatusTone;
};
export type PublicRegistrationIntent = "START_NEW" | "RESUME" | "TRACK_SAVED";

export const PUBLIC_BACK_LABEL = "Voltar";
export const PUBLIC_MANUAL_PAYMENT_SUBTITLE =
  "Finalize sua inscrição pelo WhatsApp com a organização do evento.";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,120}$/;
const TERMINAL_STATUSES = new Set(["CONFIRMED", "CHECKED_IN", "NO_SHOW", "CANCELLED", "EXPIRED", "FAILED"]);
const DANGER_STATUSES = new Set(["CANCELLED", "EXPIRED", "FAILED", "REJECTED", "NO_SHOW"]);
const WARNING_STATUSES = new Set(["PENDING", "PARTIAL", "AWAITING_PAYMENT", "PROCESSING"]);
const SUCCESS_STATUSES = new Set(["CONFIRMED", "CHECKED_IN", "PAID", "COMPLETED", "NOT_REQUIRED"]);

export function isValidPublicTrackingToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export function isTerminalPublicStatus(status: string) {
  return TERMINAL_STATUSES.has(status.toUpperCase());
}

export function shouldPollPublicStatus(input: { status: string; visible: boolean }) {
  return input.visible && !isTerminalPublicStatus(input.status);
}

export function publicStatusTone(status: string): PublicStatusTone {
  const normalized = status.toUpperCase();
  if (DANGER_STATUSES.has(normalized)) return "danger";
  if (WARNING_STATUSES.has(normalized)) return "warning";
  if (SUCCESS_STATUSES.has(normalized)) return "success";
  return "neutral";
}

export function publicRefreshNotice(status: string): PublicRefreshNotice {
  const tone = publicStatusTone(status);

  if (tone === "warning") {
    return {
      title: "Aguardando confirmação",
      message: "A inscrição ainda está pendente e aguarda confirmação da organização.",
      tone,
    };
  }

  if (tone === "success") {
    return {
      title: "Situação atualizada",
      message: "A inscrição foi confirmada.",
      tone,
    };
  }

  if (tone === "danger") {
    return {
      title: "Atenção à inscrição",
      message: "A situação da inscrição foi atualizada. Confira os detalhes exibidos na página.",
      tone,
    };
  }

  return {
    title: "Situação atualizada",
    message: "A situação mais recente da inscrição está disponível.",
    tone,
  };
}

export function publicRegistrationIntent(search: string): PublicRegistrationIntent {
  const params = new URLSearchParams(search);
  if (params.has("nova")) return "START_NEW";
  if (params.has("retomar")) return "RESUME";
  return "TRACK_SAVED";
}

export function publicTrackingState(status: string) {
  const tone = publicStatusTone(status);
  return {
    tone,
    complete: tone === "success",
    failed: tone === "danger",
    pending: tone === "warning",
  } as const;
}

export function publicResumeDestination(input: { registrationStatus: string; paymentMethod: string }): "TRACKING" | 2 | 3 {
  const state = publicTrackingState(input.registrationStatus);
  if (state.complete || state.failed) return "TRACKING";
  return input.paymentMethod === "PIX" ? 2 : 3;
}

export function buildTrackingHash(kind: PublicTrackingKind, token: string) {
  if (!isValidPublicTrackingToken(token)) return "";
  const params = new URLSearchParams({ tipo: kind === "CARAVAN" ? "caravana" : "individual", token });
  return `#${params.toString()}`;
}

export function readTrackingHash(hash: string): { kind: PublicTrackingKind; token: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("token") ?? "";
  const type = params.get("tipo");
  if (!isValidPublicTrackingToken(token) || !["individual", "caravana"].includes(type ?? "")) return null;
  return { kind: type === "caravana" ? "CARAVAN" : "INDIVIDUAL", token };
}

export function shouldShowPublicSummary(input: { step: number; completed: boolean }) {
  if (input.completed) return { visible: false, collapsible: false, defaultOpen: false } as const;
  if (input.step <= 1) return { visible: true, collapsible: false, defaultOpen: true } as const;
  return { visible: true, collapsible: true, defaultOpen: false } as const;
}

export function shouldShowTrackingPix(input: { registrationStatus: string; paymentMethod: string; hasPixCode: boolean }) {
  return !isTerminalPublicStatus(input.registrationStatus)
    && input.paymentMethod === "PIX"
    && input.hasPixCode;
}

export function isPublicManualPaymentMethod(paymentMethod: string) {
  return ["CASH", "DEBIT_CARD", "CREDIT_CARD"].includes(paymentMethod);
}
