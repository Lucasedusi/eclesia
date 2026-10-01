"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import * as S from "./member-sheet.styles";

type Props = { memberId: string; memberName: string; canHistory: boolean; canEvents: boolean; onClose: () => void };

export function MemberSheetModal({ memberId, memberName, canHistory, canEvents, onClose }: Props) {
  const id = useId();
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeEvents, setIncludeEvents] = useState(false);
  const [busy, setBusy] = useState(false);
  const downloading = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/members/${memberId}/sheet/pdf`, {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeHistory: canHistory && includeHistory, includeEvents: canEvents && includeEvents }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: unknown } | null;
        throw new Error(typeof payload?.message === "string" ? payload.message : "Não foi possível baixar a ficha. Tente novamente.");
      }
      if (!response.headers.get("Content-Type")?.includes("application/pdf")) {
        throw new Error("Não foi possível baixar a ficha. Entre novamente e tente outra vez.");
      }
      const url = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = /filename="([A-Za-z0-9_-]+\.pdf)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "ficha-membro.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setFeedback({ error: false, message: "Ficha pronta. O download foi iniciado." });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Não foi possível baixar a ficha. Tente novamente." });
    } finally {
      downloading.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal open title="Ficha do membro em PDF" description="Escolha as informações que deseja imprimir." icon={<FileText />} size="md" onClose={onClose} busy={busy}
      footer={<S.Footer><Button variant="outline" onClick={onClose} disabled={busy}>Fechar</Button><Button onClick={() => void download()} loading={busy} disabled={busy}><Download size={16} />{busy ? "Gerando PDF…" : "Baixar PDF"}</Button></S.Footer>}
    >
      <S.Content aria-busy={busy}>
        <S.MemberName>{memberName}</S.MemberName>
        <S.Included><CheckCircle2 size={20} aria-hidden="true" /><div><strong>Dados do membro</strong><p>Identificação, contato, família e histórico de fé.</p><small>Sempre incluídos</small></div></S.Included>
        {(canHistory || canEvents) && <S.Options disabled={busy}><legend>Incluir também</legend>
          {canHistory && <S.Option $selected={includeHistory}><Checkbox id={`${id}-history`} label="Linha do tempo" checked={includeHistory} onChange={(event) => setIncludeHistory(event.target.checked)} aria-describedby={`${id}-history-description`} /><p id={`${id}-history-description`}>Registros da trajetória do membro.</p></S.Option>}
          {canEvents && <S.Option $selected={includeEvents}><Checkbox id={`${id}-events`} label="Eventos" checked={includeEvents} onChange={(event) => setIncludeEvents(event.target.checked)} aria-describedby={`${id}-events-description`} /><p id={`${id}-events-description`}>Os mesmos eventos exibidos na ficha do membro.</p></S.Option>}
        </S.Options>}
        <S.Hint>Formato A4 · Pronto para impressão</S.Hint>
        {feedback && <S.Feedback $error={feedback.error} role={feedback.error ? "alert" : "status"}>{feedback.message}</S.Feedback>}
      </S.Content>
    </Modal>
  );
}
