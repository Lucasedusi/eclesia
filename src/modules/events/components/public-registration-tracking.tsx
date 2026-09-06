"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bus, Check, CheckCircle2, Clock3, Copy, CreditCard, Download, LoaderCircle, LockKeyhole, MessageCircle, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventDetail, PublicCheckoutStatus, PublicTrackingStatus } from "../types/event.types";
import { isPublicManualPaymentMethod, publicStatusTone, readTrackingHash, shouldPollPublicStatus, shouldShowTrackingPix, type PublicTrackingKind } from "../utils/public-registration-flow";
import { QrCode } from "./qr-code";
import { PublicEventHeroMeta, PublicFlowToast } from "./public-event-mobile";
import * as S from "./events.styles";

const money = (value: number) => value <= 0 ? "Gratuito" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const paymentMethod = (value: string) => ({ PIX: "Pix", CASH: "Dinheiro", NOT_APPLICABLE: "Não necessário", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito" }[value] ?? value);
const paymentStatus = (value: string) => ({ PAID: "Pago", CONFIRMED: "Pago", PARTIAL: "Parcial", PENDING: "Pendente", NOT_REQUIRED: "Não necessário", FAILED: "Falhou", CANCELLED: "Cancelado", REFUNDED: "Estornado" }[value] ?? value);
const registrationStatus = (value: string) => ({ CONFIRMED: "Confirmada", CHECKED_IN: "Credenciada", PENDING: "Pendente", CANCELLED: "Cancelada", EXPIRED: "Expirada", FAILED: "Falhou" }[value] ?? value);

export function PublicRegistrationTracking({ event }: { event: EventDetail }) {
  const [pending, startTransition] = useTransition();
  const [reference, setReference] = useState<{ kind: PublicTrackingKind; token: string } | null | undefined>(undefined);
  const [tracking, setTracking] = useState<PublicTrackingStatus | null>(null);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const location = [event.location, event.city, event.state].filter(Boolean).join(" · ");

  const queryStatus = useCallback(async (entry: { kind: PublicTrackingKind; token: string }, refreshProvider: boolean) => {
    const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/tracking`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: entry.token, refreshProvider }),
    });
    const body = await response.json() as { message?: string; data?: PublicTrackingStatus };
    if (!response.ok || !body.data) throw new Error(body.message ?? "Não foi possível consultar esta inscrição.");
    if (body.data.kind !== entry.kind) throw new Error("O link não corresponde ao tipo de inscrição informado.");
    const next = body.data;
    setTracking((current) => {
      if (next.kind === "INDIVIDUAL" && current?.kind === "INDIVIDUAL" && !next.data.pix && current.data.pix) {
        return { ...next, data: { ...next.data, pix: current.data.pix } };
      }
      return next;
    });
    return next;
  }, [event.publicCode, event.slug]);

  useEffect(() => {
    const parsed = readTrackingHash(window.location.hash);
    queueMicrotask(() => {
      if (!parsed) { setReference(null); return; }
      setReference(parsed);
      startTransition(async () => {
        try { await queryStatus(parsed, true); }
        catch (error) { setReference(null); setNotice({ message: error instanceof Error ? error.message : "Link de acompanhamento inválido.", danger: true }); }
      });
    });
  }, [queryStatus]);

  useEffect(() => {
    if (!reference || !tracking) return;
    let timer: number | undefined;
    const schedule = () => {
      if (timer) window.clearInterval(timer);
      if (!shouldPollPublicStatus({ status: tracking.status, visible: document.visibilityState === "visible" })) return;
      timer = window.setInterval(() => startTransition(async () => {
        try { await queryStatus(reference, false); } catch { /* atualização manual permanece disponível */ }
      }), 90_000);
    };
    const visibility = () => {
      schedule();
      if (document.visibilityState === "visible" && shouldPollPublicStatus({ status: tracking.status, visible: true })) {
        startTransition(async () => { try { await queryStatus(reference, true); } catch { /* sem interromper a tela já carregada */ } });
      }
    };
    schedule();
    document.addEventListener("visibilitychange", visibility);
    return () => { if (timer) window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [queryStatus, reference, tracking]);

  function refresh() {
    if (!reference) return;
    startTransition(async () => {
      try { await queryStatus(reference, true); setNotice({ message: "Situação atualizada." }); }
      catch (error) { setNotice({ message: error instanceof Error ? error.message : "Não foi possível atualizar agora.", danger: true }); }
    });
  }

  function downloadIndividualReceipt(data: PublicCheckoutStatus) {
    if (!reference) return;
    startTransition(async () => {
      const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/receipt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutToken: reference.token }) });
      if (!response.ok) { const body = await response.json() as { message?: string }; setNotice({ message: body.message ?? "Comprovante indisponível.", danger: true }); return; }
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = blobUrl; anchor.download = `comprovante-evento-${data.registrationNumber}.pdf`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    });
  }

  const whatsappNumber = (event.paymentSettings.whatsappNumber ?? "").replace(/\D/g, "");
  const newRegistrationHref = `/inscricoes/${event.publicCode}/${event.slug}`;

  return <S.PublicShell><S.PublicCard>
    <S.PublicHero $image={event.bannerUrl}><div><span>ACOMPANHAMENTO DA INSCRIÇÃO</span><h1>{event.name}</h1><PublicEventHeroMeta startsAt={event.startsAt} location={location}/></div></S.PublicHero>
    <S.PublicTrackingContent>
      {pending && !tracking ? <S.PublicTrackingLoading><LoaderCircle/><strong>Consultando sua inscrição...</strong></S.PublicTrackingLoading> : null}
      {reference === null && !tracking ? <S.PublicTrackingEmpty><span><TriangleAlert/></span><h2>Link de acompanhamento inválido</h2><p>Abra novamente o link recebido ao concluir a inscrição ou faça uma nova inscrição.</p><Link className="app-button-secondary" href={newRegistrationHref}><ArrowLeft/>Voltar às inscrições</Link></S.PublicTrackingEmpty> : null}
      {tracking?.kind === "INDIVIDUAL" ? <IndividualTracking data={tracking.data} whatsappNumber={whatsappNumber} onRefresh={refresh} onDownload={downloadIndividualReceipt} onNotice={(message)=>setNotice({message})} pending={pending} resumeHref={`${newRegistrationHref}?retomar=1`} /> : null}
      {tracking?.kind === "CARAVAN" ? <CaravanTracking data={tracking.data} token={reference?.token ?? ""} publicCode={event.publicCode ?? ""} slug={event.slug ?? ""} whatsappNumber={whatsappNumber} onRefresh={refresh} pending={pending} /> : null}
    </S.PublicTrackingContent>
    <PublicFlowToast notice={notice} onClose={()=>setNotice(null)}/>
  </S.PublicCard></S.PublicShell>;
}

function IndividualTracking({ data, whatsappNumber, onRefresh, onDownload, onNotice, pending, resumeHref }: {
  data: PublicCheckoutStatus; whatsappNumber: string; onRefresh: () => void; onDownload: (data: PublicCheckoutStatus) => void; onNotice: (message: string) => void; pending: boolean; resumeHref: string;
}) {
  const [pixCopied, setPixCopied] = useState(false);
  const complete = ["CONFIRMED", "CHECKED_IN"].includes(data.registrationStatus);
  const whatsapp = !complete && isPublicManualPaymentMethod(data.paymentMethod) && whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de combinar o pagamento ${data.paymentMethod === "CASH" ? "em dinheiro" : `presencial por ${paymentMethod(data.paymentMethod).toLocaleLowerCase("pt-BR")}`} da inscrição ${data.registrationNumber} de ${data.participantName} para o evento ${data.eventName}. Total: ${money(data.totalAmount)}.`)}` : "";
  const trackingPix = shouldShowTrackingPix({ registrationStatus: data.registrationStatus, paymentMethod: data.paymentMethod, hasPixCode: Boolean(data.pix?.qrCode) }) ? data.pix : null;
  async function copyPix() {
    if (!trackingPix?.qrCode) return;
    await navigator.clipboard.writeText(trackingPix.qrCode);
    setPixCopied(true);
    onNotice("Código Pix copiado.");
    window.setTimeout(() => setPixCopied(false), 2600);
  }
  return <S.PublicTrackingPanel>
    <S.PublicTrackingHeader data-pending={!complete}><span>{complete?<CheckCircle2/>:<Clock3/>}</span><div><S.PublicStatusBadge $tone={publicStatusTone(data.registrationStatus)}>{registrationStatus(data.registrationStatus)}</S.PublicStatusBadge><h2>{complete?"Inscrição confirmada":"Inscrição recebida"}</h2><p>{complete?"A credencial e o comprovante já estão disponíveis.":isPublicManualPaymentMethod(data.paymentMethod)?`Entre em contato pelo WhatsApp para combinar o pagamento ${data.paymentMethod === "CASH" ? "em dinheiro" : "presencial"}.`:"Aguardando a confirmação do pagamento."}</p></div></S.PublicTrackingHeader>
    <S.PublicTrackingDetails><div><small>Participante</small><strong>{data.participantName}</strong></div><div><small>Número</small><strong>{data.registrationNumber}</strong></div><div><small>Congregação</small><strong>{data.congregationName||"Não informada"}</strong></div><div><small>Regional</small><strong>{data.regionName||"Não informada"}</strong></div><div><small>Pagamento</small><strong>{paymentMethod(data.paymentMethod)}</strong></div><div><small>Situação</small><strong>{paymentStatus(data.paymentStatus)}</strong></div><div><small>Data da inscrição</small><strong>{date(data.registeredAt)}</strong></div><div><small>Total</small><strong>{money(data.totalAmount)}</strong></div></S.PublicTrackingDetails>
    {trackingPix ? <S.PixLayout><S.PixCodePanel>{trackingPix.qrCodeBase64 ? <Image unoptimized width={180} height={180} src={`data:image/png;base64,${trackingPix.qrCodeBase64}`} alt="QR Code para pagamento Pix" /> : <S.SimulatedQr><QrCode value={trackingPix.qrCode!} size={160}/></S.SimulatedQr>}<h3>Pagamento por Pix</h3><p>Escaneie o QR Code ou copie o código para concluir o pagamento.</p><S.PixKeyInput><input readOnly value={trackingPix.qrCode!} aria-label="Código Pix"/><button type="button" onClick={copyPix} aria-label={pixCopied?"Código Pix copiado":"Copiar código Pix"}>{pixCopied?<Check/>:<Copy/>}</button></S.PixKeyInput></S.PixCodePanel></S.PixLayout> : null}
    {data.credentialToken?<S.PublicTrackingCredential><div><small>CREDENCIAL DO EVENTO</small><h3>{data.participantName}</h3><p>{data.registrationNumber}{data.congregationName?` · ${data.congregationName}`:""}</p></div><QrCode value={data.credentialToken} size={150}/></S.PublicTrackingCredential>:<S.CredentialLocked><span><LockKeyhole/></span><h3>Credencial aguardando liberação</h3><p>Ela aparecerá automaticamente depois da confirmação.</p></S.CredentialLocked>}
    <S.PublicTrackingActions>{whatsapp?<S.PublicWhatsappLink href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/>Combinar pelo WhatsApp</S.PublicWhatsappLink>:null}{!complete&&data.paymentMethod==="PIX"&&!data.providerPaymentId?<Link className="app-button-secondary" href={resumeHref}><CreditCard/>Continuar pagamento</Link>:null}<Button variant="outline" onClick={onRefresh} loading={pending}><RefreshCw/>Atualizar situação</Button>{complete?<><Button variant="outline" onClick={()=>window.print()}><Printer/>Imprimir</Button><Button onClick={()=>onDownload(data)} loading={pending}><Download/>Baixar comprovante</Button></>:null}</S.PublicTrackingActions>
  </S.PublicTrackingPanel>;
}

function CaravanTracking({ data, token, publicCode, slug, whatsappNumber, onRefresh, pending }: {
  data: Extract<PublicTrackingStatus,{kind:"CARAVAN"}>["data"]; token: string; publicCode: string; slug: string; whatsappNumber: string; onRefresh: () => void; pending: boolean;
}) {
  const complete = data.paymentStatus === "PAID" || data.paymentStatus === "NOT_REQUIRED";
  const whatsapp = data.paymentMethod === "CASH" && whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de combinar o pagamento em dinheiro da caravana ${data.groupNumber} — ${data.eventName}. Responsável: ${data.responsibleName}. Origem: ${data.originChurchName}. Total: ${money(data.totalAmount)}.`)}` : "";
  return <S.PublicTrackingPanel>
    <S.PublicTrackingHeader data-pending={!complete}><span>{complete?<CheckCircle2/>:<Bus/>}</span><div><S.PublicStatusBadge $tone={publicStatusTone(data.paymentStatus)}>{paymentStatus(data.paymentStatus)}</S.PublicStatusBadge><h2>Caravana {data.groupNumber}</h2><p>{complete?"Pagamento confirmado e comprovante disponível.":data.paymentMethod==="CASH"?"Use o WhatsApp para combinar o pagamento em dinheiro com a organização.":"A inscrição foi recebida e aguarda a conferência do pagamento."}</p></div></S.PublicTrackingHeader>
    <S.PublicTrackingDetails><div><small>Igreja/origem</small><strong>{data.originChurchName}</strong></div><div><small>Cidade</small><strong>{data.originCity}/{data.originState}</strong></div><div><small>Responsável</small><strong>{data.responsibleName}</strong></div><div><small>Pastor(a)</small><strong>{data.pastorName}</strong></div><div><small>Participantes</small><strong>{data.totalRegistrations}</strong></div><div><small>Masculino / feminino</small><strong>{data.maleCount} / {data.femaleCount}</strong></div><div><small>Pagamento</small><strong>{paymentMethod(data.paymentMethod)} · {paymentStatus(data.paymentStatus)}</strong></div><div><small>Saldo</small><strong>{money(data.remainingAmount)}</strong></div></S.PublicTrackingDetails>
    <S.PublicTrackingActions>{whatsapp?<S.PublicWhatsappLink href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/>Combinar pelo WhatsApp</S.PublicWhatsappLink>:null}<Button variant="outline" onClick={onRefresh} loading={pending}><RefreshCw/>Atualizar situação</Button><Button variant="outline" onClick={()=>window.print()}><Printer/>Imprimir</Button><S.PublicDownloadLink href={`/api/public/events/${publicCode}/${slug}/groups/${token}/receipt`} target="_blank" rel="noreferrer"><Download/>Baixar comprovante</S.PublicDownloadLink></S.PublicTrackingActions>
  </S.PublicTrackingPanel>;
}
