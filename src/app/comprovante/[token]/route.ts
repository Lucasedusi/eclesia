import { loadPublicFinanceReceipt } from "@/modules/finance/services/finance-digital-receipt.service";
import { renderFinanceDigitalReceipt, renderUnavailableDigitalReceipt } from "@/modules/finance/services/finance-digital-receipt-html";
import { DIGITAL_RECEIPT_HEADERS } from "@/modules/finance/utils/finance-digital-receipt-http";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const headers = { ...DIGITAL_RECEIPT_HEADERS, "Content-Type": "text/html; charset=utf-8" };
  try {
    const { token } = await context.params;
    const receipt = await loadPublicFinanceReceipt(token);
    if (!receipt) return new Response(renderUnavailableDigitalReceipt(), { status: 404, headers });
    return new Response(renderFinanceDigitalReceipt(receipt, `/comprovante/${token}/pdf`), { headers });
  } catch {
    return new Response(renderUnavailableDigitalReceipt(), { status: 503, headers });
  }
}
