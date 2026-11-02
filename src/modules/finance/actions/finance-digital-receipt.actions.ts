"use server";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import { createFinanceDigitalReceiptLink } from "../services/finance-digital-receipt.service";
import type { FinanceActionResult } from "../types/finance.types";
import type { DigitalReceiptLink } from "../types/finance-digital-receipt.types";

export async function createFinanceDigitalReceiptLinkAction(unit: string, receiptId: string): Promise<FinanceActionResult<DigitalReceiptLink>> {
  try {
    const context = await requireFinanceContext({ congregationId: unit, permission: PERMISSIONS.financeView });
    return { ok: true, data: await createFinanceDigitalReceiptLink(context, receiptId) };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: error instanceof Error && error.message === "RECEIPT_LINK_LIMIT"
        ? "Muitos links foram preparados para este comprovante. Aguarde alguns minutos."
        : "Não foi possível preparar o comprovante digital. Verifique se ele continua válido e tente novamente.",
    };
  }
}
