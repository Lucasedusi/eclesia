"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { registerCheckinAction, reverseCheckinAction } from "../actions/event.actions";
import { CHECKIN_METHODS, eventLabel } from "../constants/events";
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
  const [congregationId, setCongregationId] = useState("");
  const [pending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processedRegistrationIds, setProcessedRegistrationIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [reverseTarget, setReverseTarget] = useState<CheckinRow | null>(null);
  const [reason, setReason] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const checkedInRegistrationIds = useMemo(() => {
    const ids = new Set(processedRegistrationIds);
    data.checkins.forEach((checkin) => { if (checkin.status === "CHECKED_IN") ids.add(checkin.registrationId); });
    return ids;
  }, [data.checkins, processedRegistrationIds]);
  const eligible = useMemo(() => data.registrations.filter((item) => {
    if (item.status !== "CONFIRMED") return false;
    if (checkedInRegistrationIds.has(item.id)) return false;
    if (congregationId && item.congregationId !== congregationId) return false;
    if (!normalizedQuery) return true;
    return `${item.registrationNumber} ${item.participantName} ${item.participantPhone ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
  }), [checkedInRegistrationIds, congregationId, data.registrations, normalizedQuery]);

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
    setProcessingId(input.registrationId ?? "qr-code");
    startTransition(async () => {
      const result = await registerCheckinAction({ eventId: data.event.id, registrationId: input.registrationId ?? "", qrToken: input.qrToken ?? "", method: input.method, notes: "" });
      setNotice({ message: result.message, danger: result.status === "error" });
      processingRef.current = false;
      setProcessingId(null);
      if (result.status === "success") {
        if (input.registrationId) setProcessedRegistrationIds((current) => new Set(current).add(input.registrationId!));
        stop();
        router.refresh();
      }
    });
  }

  function reverse() {
    if (!reverseTarget) return;
    setProcessingId(`reverse-${reverseTarget.id}`);
    startTransition(async () => {
      const result = await reverseCheckinAction({ checkinId: reverseTarget.id, reason }, data.event.id);
      setNotice({ message: result.message, danger: result.status === "error" });
      setProcessingId(null);
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

  const recent = data.checkins.filter((item) => item.status === "CHECKED_IN").slice(0, 10);
  return <S.Module>
    <PageHeader title={`Check-in · ${data.event.name}`} subtitle="Leia a credencial QR ou localize a inscrição confirmada." action={<Link className="app-button-secondary" href={`/eventos/${data.event.id}`}><ArrowLeft size={16} />Voltar</Link>} />
    <S.Grid>
      <S.Section><S.Toolbar><h2>Leitor de QR Code</h2><div>{camera ? <Button variant="outline" onClick={stop}><CameraOff size={16} />Encerrar câmera</Button> : <Button onClick={startCamera}><Camera size={16} />Ativar câmera</Button>}</div></S.Toolbar><S.Scanner aria-label="Área do leitor QR"><video ref={videoRef} playsInline muted /><div aria-hidden="true" /></S.Scanner><p>A câmera permanece ativa somente durante esta operação. Nenhuma identificação do dispositivo é armazenada.</p></S.Section>
      <S.CheckinSearchPanel>
        <h2>Busca manual</h2>
        <S.CheckinFilters>
          <S.Field><span>Nome, número ou telefone</span><S.FilterSearch><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para localizar" /></S.FilterSearch></S.Field>
          <S.Field><span>Congregação</span><select value={congregationId} onChange={(event) => setCongregationId(event.target.value)}><option value="">Todas as congregações</option>{data.references.congregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></S.Field>
        </S.CheckinFilters>
        <S.CheckinResults>
          {eligible.slice(0, 30).map((registration) => <S.CheckinResult key={registration.id}><div><strong>{registration.participantName}</strong><small>{registration.registrationNumber} · {registration.congregationName || "Sem congregação"}</small></div><S.CheckinConfirm type="button" disabled={pending && processingId !== registration.id} onClick={() => perform({ registrationId: registration.id, method: "SEARCH" })}>{pending && processingId === registration.id ? <LoaderCircle data-loading /> : <CheckCircle2 />}Confirmar</S.CheckinConfirm></S.CheckinResult>)}
          {eligible.length === 0 ? <S.CheckinEmpty>Nenhuma inscrição confirmada encontrada.</S.CheckinEmpty> : null}
        </S.CheckinResults>
      </S.CheckinSearchPanel>
    </S.Grid>
    <S.Section><h2>Entradas recentes</h2>{recent.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Inscrição</th><th>Horário</th><th>Método</th><th>Ações</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td><strong>{item.participantName}</strong></td><td>{item.registrationNumber}</td><td>{item.checkedInAt ? new Date(item.checkedInAt).toLocaleString("pt-BR") : "—"}</td><td>{eventLabel(CHECKIN_METHODS, item.method)}</td><td><S.ReverseAction type="button" onClick={() => { setReverseTarget(item); setReason(""); }}><RotateCcw />Reverter</S.ReverseAction></td></tr>)}</tbody></table></S.TableWrap> : <p>Nenhum check-in realizado.</p>}</S.Section>
    {reverseTarget ? <Modal open size="sm" title="Reverter check-in" description="O participante poderá realizar um novo check-in." icon={<RotateCcw />} onClose={() => setReverseTarget(null)} busy={pending} footer={<S.ModalFooter><Button variant="outline" onClick={() => setReverseTarget(null)}>Voltar</Button><Button variant="danger" onClick={reverse} loading={pending && processingId === `reverse-${reverseTarget.id}`} disabled={reason.trim().length < 3}>Confirmar reversão</Button></S.ModalFooter>}><S.DeleteWarning>Participante: <strong>{reverseTarget.participantName}</strong></S.DeleteWarning><S.Field style={{ marginTop: 14 }}><span>Motivo *</span><textarea data-autofocus value={reason} onChange={(change) => setReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field></Modal> : null}
    <ToastViewport>{notice ? <Toast title={notice.danger ? "Check-in não realizado" : "Check-in atualizado"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
  </S.Module>;
}
