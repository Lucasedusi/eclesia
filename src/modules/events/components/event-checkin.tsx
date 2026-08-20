"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { registerCheckinAction, reverseCheckinAction } from "../actions/event.actions";
import type { CheckinRow, EventWorkspaceData } from "../types/event.types";
import * as S from "./events.styles";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

export function EventCheckin({ data }: { data: EventWorkspaceData }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const [camera, setCamera] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [reverseTarget, setReverseTarget] = useState<CheckinRow | null>(null);
  const [reason, setReason] = useState("");
  const eligible = useMemo(() => data.registrations.filter((item) => item.status === "CONFIRMED" && `${item.registrationNumber} ${item.participantName} ${item.participantPhone ?? ""}`.toLowerCase().includes(query.toLowerCase())), [data.registrations, query]);

  function stop() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera(false);
  }

  useEffect(() => stop, []);

  function perform(input: { registrationId?: string; qrToken?: string; method: "MANUAL" | "SEARCH" | "QR_CODE" }) {
    if (processingRef.current) return;
    processingRef.current = true;
    startTransition(async () => {
      const result = await registerCheckinAction({ eventId: data.event.id, registrationId: input.registrationId ?? "", qrToken: input.qrToken ?? "", method: input.method, notes: "" });
      setNotice({ message: result.message, danger: result.status === "error" });
      processingRef.current = false;
      if (result.status === "success") { stop(); router.refresh(); }
    });
  }

  function reverse() {
    if (!reverseTarget) return;
    startTransition(async () => {
      const result = await reverseCheckinAction({ checkinId: reverseTarget.id, reason }, data.event.id);
      setNotice({ message: result.message, danger: result.status === "error" });
      if (result.status === "success") { setReverseTarget(null); setReason(""); router.refresh(); }
    });
  }

  async function startCamera() {
    try {
      const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorClass) { setNotice({ message: "Este navegador não oferece leitura nativa de QR. Use a busca manual.", danger: true }); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamera(true);
      const detector = new DetectorClass({ formats: ["qr_code"] });
      const scan = async () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && !processingRef.current) {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]?.rawValue) { perform({ qrToken: codes[0].rawValue, method: "QR_CODE" }); return; }
        }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch {
      setNotice({ message: "Não foi possível acessar a câmera. Verifique a permissão ou use a busca manual.", danger: true });
      stop();
    }
  }

  const recent = data.checkins.filter((item) => item.status === "CHECKED_IN").slice(0, 30);
  return <S.Module>
    <PageHeader title={`Check-in · ${data.event.name}`} subtitle="Leia a credencial QR ou localize a inscrição confirmada." action={<Link className="app-button-secondary" href={`/eventos/${data.event.id}`}><ArrowLeft size={16} />Voltar</Link>} />
    {notice ? <S.Notice $danger={notice.danger}>{notice.message}</S.Notice> : null}
    <S.Grid>
      <S.Section><S.Toolbar><h2>Leitor de QR Code</h2><div>{camera ? <Button variant="outline" onClick={stop}><CameraOff size={16} />Encerrar câmera</Button> : <Button onClick={startCamera}><Camera size={16} />Ativar câmera</Button>}</div></S.Toolbar><S.Scanner aria-label="Área do leitor QR"><video ref={videoRef} playsInline muted /><div aria-hidden="true" /></S.Scanner><p>A câmera permanece ativa somente durante esta operação. Nenhuma identificação do dispositivo é armazenada.</p></S.Section>
      <S.Section><h2>Busca manual</h2><S.Field><span>Nome, número ou documento</span><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#98a2b3" }} /><input value={query} onChange={(event) => setQuery(event.target.value)} style={{ paddingLeft: 36 }} placeholder="Digite para localizar" /></div></S.Field><div style={{ display: "grid", gap: 8, maxHeight: 430, overflow: "auto" }}>{eligible.slice(0, 30).map((registration) => <S.CardRow key={registration.id}><header><div><strong>{registration.participantName}</strong><br /><small>{registration.registrationNumber}</small></div><Button size="sm" loading={pending} onClick={() => perform({ registrationId: registration.id, method: "SEARCH" })}><CheckCircle2 size={15} />Confirmar</Button></header></S.CardRow>)}{eligible.length === 0 ? <p>Nenhuma inscrição confirmada encontrada.</p> : null}</div></S.Section>
    </S.Grid>
    <S.Section><h2>Entradas recentes</h2>{recent.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Inscrição</th><th>Horário</th><th>Método</th><th>Ação</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td><strong>{item.participantName}</strong></td><td>{item.registrationNumber}</td><td>{item.checkedInAt ? new Date(item.checkedInAt).toLocaleString("pt-BR") : "—"}</td><td>{item.method}</td><td><button className="app-button-secondary" onClick={() => { setReverseTarget(item); setReason(""); }}>Reverter</button></td></tr>)}</tbody></table></S.TableWrap> : <p>Nenhum check-in realizado.</p>}</S.Section>
    {reverseTarget ? <Modal open size="sm" title="Reverter check-in" description="O histórico será preservado e o participante poderá realizar um novo check-in." icon={<RotateCcw />} onClose={() => setReverseTarget(null)} busy={pending} footer={<S.ModalFooter><Button variant="outline" onClick={() => setReverseTarget(null)}>Voltar</Button><Button variant="danger" onClick={reverse} loading={pending} disabled={reason.trim().length < 3}>Confirmar reversão</Button></S.ModalFooter>}><S.DeleteWarning>Participante: <strong>{reverseTarget.participantName}</strong></S.DeleteWarning><S.Field style={{ marginTop: 14 }}><span>Motivo *</span><textarea data-autofocus value={reason} onChange={(change) => setReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field></Modal> : null}
    <ToastViewport>{notice ? <Toast title={notice.danger ? "Check-in não realizado" : "Check-in atualizado"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
  </S.Module>;
}
