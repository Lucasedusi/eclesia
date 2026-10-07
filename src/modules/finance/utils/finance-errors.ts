import { ZodError } from "zod";
import type {
  FinanceActionResult,
  FinanceErrorCode,
} from "../types/finance.types";
const messages: Record<FinanceErrorCode, string> = {
  FORBIDDEN: "Seu acesso não permite esta operação nesta congregação.",
  INVALID_INPUT: "Confira os campos informados.",
  INACTIVE_REFERENCE:
    "Um cadastro foi inativado. Escolha uma opção ativa; seu preenchimento foi preservado.",
  CONFLICT: "Este registro mudou. Atualize os dados antes de continuar.",
  IDEMPOTENCY_CONFLICT:
    "Esta tentativa já foi usada com outros dados. Confira a confirmação anterior.",
  PREBEND_CAP_REQUIRED:
    "Configure o teto mensal da prebenda bruta nas regras desta congregação antes de gerar o demonstrativo.",
  CONFIGURATION_REQUIRED:
    "Complete as configurações financeiras desta congregação.",
  LEGACY_DATA_REQUIRES_REVIEW:
    "Este registro antigo precisa ser conferido pelo administrador.",
  UNAVAILABLE:
    "Não foi possível confirmar a operação. Tente novamente com os mesmos dados.",
};
export function financeFailure(error: unknown): FinanceActionResult<never> {
  if (error instanceof ZodError)
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: messages.INVALID_INPUT,
      fieldErrors: Object.fromEntries(
        error.issues.map((i) => [i.path.join("."), [i.message]]),
      ),
    };
  const code =
    error instanceof Error && error.message in messages
      ? (error.message as FinanceErrorCode)
      : "UNAVAILABLE";
  return { ok: false, code, message: messages[code] };
}
export function throwFinanceDatabaseError(error: {
  message: string;
  code?: string;
}): never {
  const key = Object.keys(messages).find((code) => error.message === code);
  throw new Error(
    key ??
      (["23514", "23503", "22P02", "22007", "22008", "22023"].includes(
        error.code ?? "",
      )
        ? "INVALID_INPUT"
        : "UNAVAILABLE"),
  );
}
