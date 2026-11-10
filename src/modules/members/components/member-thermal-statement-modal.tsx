"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MemberFinanceFilters } from "../validations/member-finance.schemas";
import * as S from "./member-details.styles";
import * as T from "./member-thermal-statement.styles";

async function prepare(
  memberId: string,
  filters: MemberFinanceFilters,
  width: 80 | 58,
  intent: "preview" | "print",
  signal: AbortSignal,
) {
  const response = await fetch("/api/members/finance/statement", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, filters, width, intent }),
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.message || "Não foi possível preparar o extrato.");
  }
  if (!response.headers.get("Content-Type")?.includes("text/html"))
    throw new Error("Entre novamente para imprimir.");
  return response.text();
}

export function MemberThermalStatementModal({
  memberId,
  filters,
  onClose,
}: {
  memberId: string;
  filters: MemberFinanceFilters;
  onClose: () => void;
}) {
  const [width, setWidth] = useState<80 | 58>(80);
  const [document, setDocument] = useState<{
    html: string;
    version: number;
  } | null>(null);
  const [loading, setLoading] = useState(true),
    [printing, setPrinting] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null),
    pendingPrint = useRef<number | null>(null),
    revision = useRef(0),
    printLock = useRef(false),
    printController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    prepare(memberId, filters, width, "preview", controller.signal)
      .then((html) => {
        if (!controller.signal.aborted)
          setDocument({
            html,
            version: ++revision.current,
          });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível preparar a prévia.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      printController.current?.abort();
      pendingPrint.current = null;
    };
  }, [memberId, filters, width, retry]);

  async function print() {
    if (printLock.current) return;
    printLock.current = true;
    setPrinting(true);
    setError("");
    const controller = new AbortController();
    printController.current = controller;
    try {
      const html = await prepare(
        memberId,
        filters,
        width,
        "print",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const version = ++revision.current;
      pendingPrint.current = version;
      setDocument({
        html,
        version,
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir a impressão.",
        );
        setPrinting(false);
      }
      printLock.current = false;
    }
  }
  async function onFrameLoad(version: number) {
    if (pendingPrint.current !== version) return;
    pendingPrint.current = null;
    try {
      const target = frame.current?.contentWindow;
      if (!target)
        throw new Error("Não foi possível abrir a impressão. Tente novamente.");
      await Promise.all(
        Array.from(target.document.images).map((img) =>
          img.decode().catch(() => {}),
        ),
      );
      if (printController.current?.signal.aborted) return;
      target.focus();
      target.print();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir a impressão.",
      );
    } finally {
      printLock.current = false;
      setPrinting(false);
    }
  }
  return (
    <T.StatementModal
      title="Extrato do contribuinte"
      description="Prévia para impressão térmica · somente entradas confirmadas."
      icon={<Printer size={22} />}
      size="sm"
      onClose={onClose}
      busy={printing}
      footer={
        <>
          <Button variant="outline" disabled={printing} onClick={onClose}>
            Fechar
          </Button>
          <Button
            disabled={loading || !document}
            loading={printing}
            aria-busy={printing}
            onClick={() => void print()}
          >
            {!printing && <Printer size={16} />}Imprimir
          </Button>
        </>
      }
    >
      <T.Controls>
        <S.FormField>
          <span>Largura do papel</span>
          <S.FinanceFilterSelect
            value={width}
            disabled={loading || printing}
            onChange={(e) => {
              const next = Number(e.target.value) as 80 | 58;
              if (next === width) return;
              setLoading(true);
              setError("");
              setDocument(null);
              setWidth(next);
            }}
          >
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </S.FinanceFilterSelect>
        </S.FormField>
        <p>
          Selecione a mesma largura na impressora e use escala de 100%. O
          navegador abrirá a escolha da impressora.
        </p>
      </T.Controls>
      {error && (
        <S.Error role="alert">
          {error}
          {!document && (
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setError("");
                setRetry((v) => v + 1);
              }}
            >
              Tentar novamente
            </Button>
          )}
        </S.Error>
      )}
      {loading ? (
        <S.Loading role="status" aria-label="Preparando extrato">
          <Loader2 />
        </S.Loading>
      ) : (
        document && (
          <T.Preview>
            <iframe
              key={document.version}
              ref={frame}
              title="Prévia do extrato térmico"
              sandbox="allow-same-origin allow-modals"
              referrerPolicy="no-referrer"
              style={{ width: `${width}mm` }}
              srcDoc={document.html}
              onLoad={() => void onFrameLoad(document.version)}
            />
          </T.Preview>
        )
      )}
    </T.StatementModal>
  );
}
