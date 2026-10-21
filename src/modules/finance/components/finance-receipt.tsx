"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceiptDTO } from "../types/finance-command.types";
import { formatMoney } from "../utils/finance-money";
import { recordFinancePrintAction } from "../actions/finance-receipt.actions";
export function FinanceReceipt({
  receipt,
  unit,
  autoPrint = false,
}: {
  receipt: ReceiptDTO;
  unit: string;
  autoPrint?: boolean;
}) {
  const [width, setWidth] = useState(80),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    started = useRef(false);
  const logo = useRef<HTMLImageElement>(null);
  // Reserve 1 mm on the right of the 48 mm print head without shifting the left edge.
  const printableWidth = width === 58 ? 47 : width - 6;
  const leftMargin = width === 58 ? 5 : 3;
  const rightMargin = width - printableWidth - leftMargin;
  const registeredTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(receipt.registeredAt));
  const requestPrint = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await recordFinancePrintAction(unit, receipt.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Data URI is loaded locally; decoding also covers automatic printing.
      await logo.current?.decode().catch(() => {});
      window.print();
    } catch {
      setError(
        "Não foi possível abrir a impressão. O lançamento continua confirmado; tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }, [unit, receipt.id]);
  useEffect(() => {
    if (autoPrint && !started.current) {
      started.current = true;
      void requestPrint();
    }
  }, [autoPrint, requestPrint]);
  return (
    <div className="stack">
      <style>{`
        @media print {
          /* Use the roll size selected in the printer driver; "58mm auto" is invalid CSS. */
          @page { size: auto; margin: 3mm ${rightMargin}mm 3mm ${leftMargin}mm; }
          html, body { background: white !important; }
          .financial-receipt {
            width: ${printableWidth}mm !important;
            max-width: 100% !important;
            box-sizing: border-box;
            border: 0 !important;
            padding: 0 !important;
            /* Stay in the left printable strip if the driver reports a wider page (e.g. A4). */
            margin: 0 !important;
            font-size: 10px !important;
          }
          .financial-receipt h1 { font-size: 11px !important; }
          ${width === 58 ? `
            html, body { margin: 0 !important; padding: 0 !important; }
            .financial-receipt .receipt-amount-row { flex-wrap: wrap; gap: 4px 8px; }
            .financial-receipt .receipt-amount-row > span { margin-left: auto; white-space: nowrap; }
          ` : ""}
        }
      `}</style>
      <div className="no-print row finance-receipt-controls finance-mobile-receipt-controls">
        <label>
          Largura do papel
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </select>
        </label>
        <Button loading={busy} onClick={() => void requestPrint()}>
          <Printer size={16} />
          Imprimir comprovante
        </Button>
        <span className="muted">
          O navegador abrirá a escolha da impressora.
          {width === 58 && " Use papel de 58 mm, escala 100% e margens padrão: o comprovante reserva 47 mm para impressão."}
        </span>
      </div>
      {error && (
        <div role="alert" className="no-print">
          {error}
        </div>
      )}
      <article
        className="financial-receipt card stack"
        style={{
          width: `${width}mm`,
          maxWidth: "100%",
          margin: "0 auto",
          fontSize: 12,
          gap: 12,
          padding: 18,
          color: "black",
          overflowWrap: "anywhere",
        }}
      >
        <header style={{ textAlign: "center", display: "grid", justifyItems: "center", gap: 6, borderBottom: "1px dashed black", paddingBottom: 8 }}>
          {receipt.logoDataUri && (
            <Image
              ref={logo}
              src={receipt.logoDataUri}
              alt="Logo da igreja"
              width={64}
              height={64}
              unoptimized
              loading="eager"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
              style={{ width: "14mm", height: "14mm", objectFit: "contain", filter: "grayscale(1) contrast(1.2)" }}
            />
          )}
          <h1 style={{ fontSize: 13, lineHeight: 1.35, letterSpacing: 0, margin: 0 }}>{receipt.churchName}</h1>
          <strong>{receipt.congregationName}</strong>
          <p style={{ margin: 0 }}>
            {receipt.direction === "EXPENSE"
              ? "Comprovante de saída"
              : "Comprovante de contribuição"}
          </p>
        </header>
        {["SUPERSEDED", "CANCELLED"].includes(receipt.status) && (
          <strong
            style={{
              textAlign: "center",
              border: "2px solid black",
              padding: 8,
            }}
          >
            {receipt.status === "CANCELLED" ? "CANCELADO" : "SUBSTITUÍDO"}
          </strong>
        )}
        <div>
          <strong style={{ display: "block", textAlign: "left", fontSize: "0.9em", marginBottom: 2 }}>
            {receipt.personName || "Contribuição coletiva"}
          </strong>
          Data: <time dateTime={receipt.date}>{receipt.date.split("-").reverse().join("/")}</time>
          {" às "}<time dateTime={receipt.registeredAt}>{registeredTime}</time>
          <br />
          Pagamento: {receipt.paymentMethodName}
        </div>
        <div
          style={{
            borderTop: "1px dashed black",
            borderBottom: "1px dashed black",
            padding: "10px 0",
          }}
        >
          {receipt.items.map((item) => (
            <div
              key={item.transactionId}
              data-testid="receipt-item"
              style={{ marginBottom: 9 }}
            >
              <div
                className="receipt-amount-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <strong>{item.categoryName}</strong>
                <span style={{ whiteSpace: "nowrap" }}>
                  {formatMoney(item.amountCents)}
                </span>
              </div>
              <small style={{ fontSize: "0.95em" }}>
                {item.departmentName}
                {item.classificationName ? ` · ${item.classificationName}` : ""}
              </small>
            </div>
          ))}
        </div>
        <div
          className="receipt-amount-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Total <span>{formatMoney(receipt.totalCents)}</span>
        </div>
        <footer style={{ borderTop: "1px dashed black", paddingTop: 8, textAlign: "center", fontSize: 9, display: "grid", gap: 6, lineHeight: 1.4 }}>
          <p style={{ margin: 0 }}>
            {receipt.direction === "EXPENSE"
              ? "Registro de saída de recursos."
              : "Obrigado por sua contribuição."}
          </p>
          {receipt.direction === "INCOME" && (
            <p style={{ margin: 0 }}>Deus ama quem dá com alegria</p>
          )}
          {(receipt.congregationAddress || receipt.churchDocument) && (
            <div style={{ paddingTop: 8, display: "grid", gap: 4 }}>
              {receipt.congregationAddress && (
                <address style={{ fontStyle: "normal" }}>{receipt.congregationAddress}</address>
              )}
              {receipt.churchDocument && <p style={{ margin: 0 }}>CNPJ: {receipt.churchDocument}</p>}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 8 }}>Eclesias</p>
        </footer>
      </article>
    </div>
  );
}
