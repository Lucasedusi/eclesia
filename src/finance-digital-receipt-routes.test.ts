import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ load: vi.fn(), pdf: vi.fn(), session: vi.fn() }));
vi.mock("@/modules/finance/services/finance-digital-receipt.service", () => ({ loadPublicFinanceReceipt: m.load }));
vi.mock("@/modules/finance/services/finance-digital-receipt-pdf.service", () => ({ createFinanceDigitalReceiptPdf: m.pdf }));
vi.mock("@/modules/finance/services/finance-digital-receipt-html", () => ({ renderFinanceDigitalReceipt: () => "<html>comprovante</html>", renderUnavailableDigitalReceipt: () => "<html>Comprovante indisponível</html>" }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: m.session }));
import { GET as page } from "./app/comprovante/[token]/route";
import { GET as pdf } from "./app/comprovante/[token]/pdf/route";
import { proxy } from "./proxy";
const token = "a".repeat(43);
const request = new Request(`https://igreja.test/comprovante/${token}`);
const context = { params: Promise.resolve({ token }) };
beforeEach(() => {
  vi.clearAllMocks();
  m.load.mockResolvedValue({ number: 'FIN-123"\r\ninjected' });
  m.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
});
it("serves public HTML without caches, referrers, scripts or indexing", async () => {
  const response = await page(request, context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
  expect(m.load).toHaveBeenCalledWith(token);
});
it("downloads a PDF with a safe filename and revalidates access", async () => {
  const response = await pdf(request, context);
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="comprovante-FIN-123injected.pdf"');
  expect(m.load).toHaveBeenCalledWith(token);
});
it("does not render either format for invalidated access", async () => {
  m.load.mockResolvedValue(null);
  expect((await page(request, context)).status).toBe(404);
  expect((await pdf(request, context)).status).toBe(404);
  expect(m.pdf).not.toHaveBeenCalled();
});
it("returns generic failures without provider details", async () => {
  m.load.mockRejectedValue(new Error("PRIVATE_DATABASE_DETAILS"));
  for (const handler of [page, pdf]) {
    const response = await handler(request, context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_DATABASE_DETAILS");
  }
});
it("bypasses session lookup on public receipts and never logs the bearer token", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "development");
  try {
    const response = await proxy(new NextRequest(request.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(m.session).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  } finally { log.mockRestore(); vi.unstubAllEnvs(); }
});
