"use client";
import { useEffect, useRef, useState } from "react";
import { useFinanceNavigation } from "../components/finance-shell";
export function useFinanceReportPdf(payload: unknown, filename: string) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pdf, setPdf] = useState<{
    url: string;
    name: string;
    opened: boolean;
  } | null>(null);
  const controller = useRef<AbortController | null>(null),
    url = useRef<string | null>(null),
    pendingTab = useRef<Window | null>(null);
  const { isPending } = useFinanceNavigation();
  useEffect(
    () => () => {
      controller.current?.abort();
      pendingTab.current?.close();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  useEffect(() => {
    if (isPending) {
      controller.current?.abort();
      pendingTab.current?.close();
      pendingTab.current = null;
    }
  }, [isPending]);
  function invalidate() {
    controller.current?.abort();
    pendingTab.current?.close();
    pendingTab.current = null;
    controller.current = null;
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setPdf(null);
    setError("");
    setBusy(false);
  }
  async function generate() {
    invalidate();
    // Reserve the tab during the click; opening after fetch may be blocked.
    let tab: Window | null = null;
    try {
      tab = window.open("about:blank", "_blank");
      if (tab) {
        tab.opener = null;
        tab.document.title = "Preparando relatório — Eclesias";
        const waiting = tab.document.createElement("main");
        waiting.setAttribute("role", "status");
        waiting.setAttribute("aria-busy", "true");
        const spinner = tab.document.createElement("span");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        const title = tab.document.createElement("h1");
        const responsiveText = (desktop: string, mobile: string) => {
          const regular = tab!.document.createElement("span");
          regular.className = "desktop";
          regular.textContent = desktop;
          const compact = tab!.document.createElement("span");
          compact.className = "mobile";
          compact.textContent = mobile;
          return [regular, compact];
        };
        title.append(
          ...responsiveText("Preparando o PDF…", "Preparando relatório…"),
        );
        const message = tab.document.createElement("p");
        message.append(
          ...responsiveText(
            "Você pode aguardar nesta aba. O relatório abrirá assim que estiver pronto.",
            "O PDF abrirá assim que estiver pronto.",
          ),
        );
        waiting.append(spinner, title, message);
        const style = tab.document.createElement("style");
        style.textContent = `
          body { margin:0; min-height:100vh; display:grid; place-items:center; background:#f5f8f6; color:#183d2e; font:14px system-ui,sans-serif; }
          main { margin:24px; padding:36px; max-width:420px; text-align:center; background:white; border:1px solid #dfe8e2; border-radius:16px; }
          h1 { font-size:20px; margin:18px 0 10px; } p { color:#52675c; line-height:1.6; }
          .spinner { display:inline-block; width:30px; height:30px; border:3px solid #dfe8e2; border-top-color:#087e5c; border-radius:50%; animation:spin .8s linear infinite; }
          .mobile { display:none; }
          @media (max-width:760px) {
            body { min-height:100dvh; padding:16px; box-sizing:border-box; }
            main { box-sizing:border-box; width:100%; max-width:360px; margin:0; padding:28px 20px; }
            .desktop { display:none; }
            .mobile { display:inline; }
          }
          @keyframes spin { to { transform:rotate(360deg); } }
          @media (prefers-reduced-motion:reduce) { .spinner { animation:none; } }
        `;
        const viewport = tab.document.createElement("meta");
        viewport.name = "viewport";
        viewport.content = "width=device-width, initial-scale=1";
        tab.document.documentElement.lang = "pt-BR";
        tab.document.head.append(viewport, style);
        tab.document.body.replaceChildren(waiting);
      }
    } catch {
      tab?.close();
      tab = null;
    }
    pendingTab.current = tab;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    try {
      const response = await fetch("/api/finance/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: request.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.message ||
            "Não foi possível gerar o relatório. Tente novamente.",
        );
      }
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error("Entre novamente para gerar o relatório.");
      const blob = await response.blob();
      if (request.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      url.current = objectUrl;
      let opened = false;
      if (tab && !tab.closed) {
        try {
          tab.location.replace(objectUrl);
          opened = true;
        } catch {
          tab.close();
        }
      }
      pendingTab.current = null;
      setPdf({
        opened,
        url: objectUrl,
        name: filename,
      });
    } catch (e) {
      tab?.close();
      if (!request.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível gerar o relatório.",
        );
    } finally {
      if (controller.current === request) {
        controller.current = null;
        pendingTab.current = null;
        setBusy(false);
      }
    }
  }
  return {
    busy,
    error,
    pdf: isPending ? null : pdf,
    generate,
    invalidate,
    isPending,
  };
}
