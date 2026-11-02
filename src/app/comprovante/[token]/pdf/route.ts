import { loadPublicFinanceReceipt } from "@/modules/finance/services/finance-digital-receipt.service";
import { createFinanceDigitalReceiptPdf } from "@/modules/finance/services/finance-digital-receipt-pdf.service";
import { DIGITAL_RECEIPT_HEADERS } from "@/modules/finance/utils/finance-digital-receipt-http";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const receipt = await loadPublicFinanceReceipt(token);
    if (!receipt) return new Response("Comprovante indisponível. Solicite um novo link à tesouraria.", { status: 404, headers: DIGITAL_RECEIPT_HEADERS });
    const bytes = await createFinanceDigitalReceiptPdf(receipt);
    const number = receipt.number.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    return new Response(new Uint8Array(bytes), {
      headers: { ...DIGITAL_RECEIPT_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="comprovante-${number}.pdf"` },
    });
  } catch {
    return new Response("Comprovante indisponível. Tente novamente em alguns instantes.", { status: 503, headers: DIGITAL_RECEIPT_HEADERS });
  }
}
