import { ZodError } from "zod";
import type {
  FinanceActionResult,
  FinanceErrorCode,
} from "../types/finance.types";
const messages: Record<FinanceErrorCode, string> = {
  BANK_IMPORT_DELETE_BLOCKED: "Este extrato ou item possui histórico financeiro e não pode ser excluído.",
  BANK_IMPORT_FILE:
    "Envie um XLSX do Sicoob de até 5 MB e 5.000 movimentos, com uma única aba e sem fórmulas, macros ou vínculos externos.",
  BANK_IMPORT_CONFLICT:
    "Este item foi atualizado por outra pessoa. Recarregue a conferência antes de continuar.",
  BANK_IMPORT_STATE:
    "A situação deste item não permite esta ação. Recarregue a conferência e consulte o histórico.",
  BANK_IMPORT_SOURCE_MISMATCH:
    "Data, conta, direção e total devem corresponder ao movimento do extrato.",
  BANK_IMPORT_TARGET_MISMATCH:
    "O registro escolhido não corresponde integralmente à conta, data, direção e valor deste movimento.",
  BANK_IMPORT_TARGET_USED:
    "Este registro já está vinculado a outra linha. Confira se é o mesmo movimento importado novamente.",
  BANK_IMPORT_DUPLICATE_REVIEW:
    "Há uma linha idêntica em outra importação. Vincule a mesma movimentação ou justifique por que são movimentos distintos.",
  BANK_IMPORT_RECONCILIATION:
    "Confira a divergência dos saldos do arquivo e informe um motivo para prosseguir.",
  BANK_IMPORT_INVALID_ROW:
    "Esta linha contém dados que não puderam ser lidos. Confira o arquivo original; ela não pode gerar um lançamento.",
  FORBIDDEN: "Seu acesso não permite esta operação nesta congregação.",
  STATEMENT_REASON_REQUIRED:
    "Informe uma justificativa de pelo menos 5 caracteres: a alteração afeta um período passado ou com demonstrativo já gerado.",
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
  return {
    ok: false,
    code,
    message: messages[code],
    ...(code === "STATEMENT_REASON_REQUIRED"
      ? { fieldErrors: { retroactiveReason: [messages[code]] } }
      : {}),
  };
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
