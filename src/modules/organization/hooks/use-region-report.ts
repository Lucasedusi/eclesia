"use client";
import { useRef, useState } from "react";
import type { RegionReportOptions } from "../types/region-report.types";

export function useRegionReport() {
  const [busy, setBusy] = useState(false);
  const downloading = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  async function download(input: RegionReportOptions) {
    if (downloading.current) return;
    downloading.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await fetch("/api/organization/regions/reports", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: unknown } | null;
        throw new Error(typeof payload?.message === "string" ? payload.message : "Não foi possível baixar o relatório. Tente novamente.");
      }
      const expectedType = input.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (!response.headers.get("Content-Type")?.includes(expectedType)) throw new Error("Entre novamente e tente gerar o relatório.");
      const url = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = /filename="([A-Za-z0-9_-]+\.(?:pdf|xlsx))"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `relatorio-regionais.${input.format}`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setFeedback({ error: false, message: "Relatório pronto. O download foi iniciado." });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Não foi possível gerar o relatório agora. Tente novamente." });
    } finally { downloading.current = false; setBusy(false); }
  }

  return { busy, feedback, download, setFeedback };
}
