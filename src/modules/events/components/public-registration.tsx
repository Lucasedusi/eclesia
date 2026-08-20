"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Banknote, BedDouble, Bus, CalendarDays, Check, CheckCircle2, Clock3, Copy, CreditCard, Download, Gift, LoaderCircle, LockKeyhole, MapPin, Minus, Plus, Printer, QrCode as QrCodeIcon, ShieldCheck, Shirt, Smartphone, Ticket, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBrazilPhone, formatCpf } from "@/utils/input-masks";
import type { EventDetail, PublicCheckoutStatus } from "../types/event.types";
import * as S from "./events.styles";
import { QrCode } from "./qr-code";

type Item = { id: string; name: string; description: string | null; item_type: string; price: number; is_required: boolean; allow_quantity: boolean; min_quantity: number; max_quantity: number | null; available_quantity: number | null };
type Congregation = { id: string; name: string; regionId: string | null; regionName: string | null };
type Props = { event: EventDetail; items: Item[]; congregations: Congregation[]; isRegistrationOpen: boolean };
type Step = 1 | 2 | 3;
type PaymentMethod = "PIX" | "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "NOT_APPLICABLE";
type PixData = { qrCode: string | null; qrCodeBase64: string | null; ticketUrl: string | null; expiresAt: string | null; paymentStatus: string; isSimulated: boolean };

const itemIcons: Record<string, typeof Ticket> = { REGISTRATION: Ticket, SHIRT: Shirt, FOOD: UtensilsCrossed, LODGING: BedDouble, TRANSPORT: Bus, KIT: Gift, DONATION: Gift, OTHER: Ticket };
const methodOptions: { value: Exclude<PaymentMethod, "NOT_APPLICABLE">; label: string; description: string; icon: typeof Smartphone }[] = [
  { value: "PIX", label: "Pix", description: "Pagamento on-line com confirmação automática", icon: Smartphone },
  { value: "CASH", label: "Dinheiro", description: "Pagamento presencial à organização", icon: Banknote },
  { value: "DEBIT_CARD", label: "Cartão de débito", description: "Pagamento presencial à organização", icon: CreditCard },
  { value: "CREDIT_CARD", label: "Cartão de crédito", description: "Pagamento presencial à organização", icon: CreditCard },
];

function money(value: number) { return value <= 0 ? "Gratuito" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function methodLabel(value: PaymentMethod) { return methodOptions.find((item) => item.value === value)?.label ?? "Não necessário"; }

export function PublicRegistration({ event, items, congregations, isRegistrationOpen }: Props) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [checkoutToken, setCheckoutToken] = useState("");
  const [checkout, setCheckout] = useState<PublicCheckoutStatus | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [regionId, setRegionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [selected, setSelected] = useState(() => new Set(items.filter((item) => item.is_required).map((item) => item.id)));
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, Math.max(item.min_quantity, 1)])));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [payerEmail, setPayerEmail] = useState("");
  const [payerCpf, setPayerCpf] = useState("");
  const checkoutKey = `eklesia:event-checkout:${event.id}`;
  const checkoutIdempotency = useRef(`checkout_${crypto.randomUUID()}`);
  const pixIdempotency = useRef(`pix_${crypto.randomUUID()}`);

  const regions = useMemo(() => Array.from(new Map(congregations.filter((item) => item.regionId).map((item) => [item.regionId!, { id: item.regionId!, name: item.regionName || "Regional" }])).values()), [congregations]);
  const filteredCongregations = congregations.filter((item) => !regionId || item.regionId === regionId);
  const selectedItems = items.filter((item) => selected.has(item.id)).map((item) => ({ ...item, quantity: quantities[item.id] ?? 1 }));
  const selectedTotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const effectiveMethod: PaymentMethod = selectedTotal <= 0 ? "NOT_APPLICABLE" : paymentMethod;
  const activeMethod: PaymentMethod = checkout?.paymentMethod ?? effectiveMethod;

  async function readJson(response: Response) { return response.json() as Promise<{ message?: string; fieldErrors?: Record<string, string[]>; data?: unknown }>; }

  async function queryStatus(token: string, refreshProvider: boolean) {
    const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/checkout/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutToken: token, refreshProvider }) });
    const body = await readJson(response);
    if (!response.ok || !body.data) throw new Error(body.message ?? "Não foi possível consultar a inscrição.");
    const status = body.data as PublicCheckoutStatus;
    setCheckout(status);
    if (status.pix) setPix({ ...status.pix, expiresAt: status.expiresAt, paymentStatus: status.paymentStatus });
    if (status.registrationStatus === "CONFIRMED") { setStep(3); setNotice({ message: "Pagamento confirmado. Sua credencial está disponível." }); }
    return status;
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(checkoutKey);
    if (!saved) return;
    queueMicrotask(() => {
      setCheckoutToken(saved);
      startTransition(async () => {
        try {
          const status = await queryStatus(saved, true);
          if (status.registrationStatus === "CONFIRMED") setStep(3); else if (status.paymentMethod === "PIX") setStep(2); else setStep(3);
        } catch { sessionStorage.removeItem(checkoutKey); setCheckoutToken(""); }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutKey]);

  useEffect(() => {
    const expiresAt = pix?.expiresAt ?? checkout?.expiresAt;
    const update = () => setSecondsLeft(expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)) : 0);
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [pix?.expiresAt, checkout?.expiresAt]);

  useEffect(() => {
    if (step !== 2 || !checkoutToken || activeMethod !== "PIX" || !pix || pix.isSimulated || checkout?.registrationStatus === "CONFIRMED") return;
    const timer = window.setInterval(() => { startTransition(async () => { try { await queryStatus(checkoutToken, true); } catch { /* consulta manual permanece disponível */ } }); }, 12_000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, checkoutToken, activeMethod, Boolean(pix), checkout?.registrationStatus]);

  function changeQuantity(item: Item, difference: number) {
    setQuantities((current) => { const minimum = Math.max(item.min_quantity, 1); const maximum = Math.min(item.max_quantity ?? 99, item.available_quantity ?? 99); return { ...current, [item.id]: Math.min(maximum, Math.max(minimum, (current[item.id] ?? minimum) + difference)) }; });
  }

  function submitRegistration(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setNotice(null); setFieldErrors({});
    const form = new FormData(formEvent.currentTarget);
    const payload = { eventId: event.id, website: String(form.get("website") ?? ""), participantKind: "VISITOR", congregationId: String(form.get("congregationId") ?? ""), participantName: String(form.get("participantName") ?? ""), participantGender: String(form.get("participantGender") ?? ""), participantPhone: String(form.get("participantPhone") ?? ""), preferredPaymentMethod: effectiveMethod, consentAccepted: form.has("consentAccepted"), consentVersion: "2026-08", items: selectedItems.map((item) => ({ itemId: item.id, quantity: item.quantity })) };
    startTransition(async () => {
      const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/checkout`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": checkoutIdempotency.current }, body: JSON.stringify(payload) });
      const body = await readJson(response);
      if (!response.ok || !body.data) { setFieldErrors(body.fieldErrors ?? {}); setNotice({ message: body.message ?? "Não foi possível iniciar a inscrição.", danger: true }); return; }
      const data = body.data as { checkoutToken: string }; setCheckoutToken(data.checkoutToken); sessionStorage.setItem(checkoutKey, data.checkoutToken);
      const status = await queryStatus(data.checkoutToken, false); setStep(status.totalAmount <= 0 ? 3 : 2); window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function generatePix(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setNotice(null); setFieldErrors({});
    startTransition(async () => {
      const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/payments/pix`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": pixIdempotency.current }, body: JSON.stringify({ checkoutToken, payerEmail, payerCpf }) });
      const body = await readJson(response);
      if (!response.ok || !body.data) { setFieldErrors(body.fieldErrors ?? {}); setNotice({ message: body.message ?? "Não foi possível gerar o Pix.", danger: true }); return; }
      const data = body.data as { checkout: PublicCheckoutStatus; pix: PixData }; setCheckout(data.checkout); setPix({ ...data.pix, expiresAt: data.pix.expiresAt ?? data.checkout.expiresAt }); setNotice({ message: data.pix.isSimulated ? "Pix de teste gerado. Nenhuma cobrança real foi criada." : "Pix gerado. A confirmação será atualizada automaticamente." });
    });
  }

  function refreshStatus() { startTransition(async () => { try { await queryStatus(checkoutToken, true); } catch (error) { setNotice({ message: error instanceof Error ? error.message : "Não foi possível verificar agora.", danger: true }); } }); }
  function approveSimulatedPayment() { startTransition(async () => { try { const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/payments/pix/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutToken }) }); const body = await readJson(response); if (!response.ok || !body.data) throw new Error(body.message ?? "Não foi possível aprovar o pagamento de teste."); const status = body.data as PublicCheckoutStatus; setCheckout(status); if (status.pix) setPix({ ...status.pix, expiresAt: status.expiresAt, paymentStatus: status.paymentStatus }); setStep(3); setNotice({ message: "Pagamento de teste aprovado. Comprovante e credencial liberados." }); window.scrollTo({ top: 0, behavior: "smooth" }); } catch (error) { setNotice({ message: error instanceof Error ? error.message : "Não foi possível aprovar o pagamento de teste.", danger: true }); } }); }
  async function copyPix() { if (!pix?.qrCode) return; await navigator.clipboard.writeText(pix.qrCode); setNotice({ message: "Código Pix copiado." }); }
  function downloadReceipt() { startTransition(async () => { const response = await fetch(`/api/public/events/${event.publicCode}/${event.slug}/receipt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkoutToken }) }); if (!response.ok) { const body = await readJson(response); setNotice({ message: body.message ?? "Comprovante indisponível.", danger: true }); return; } const blobUrl = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = blobUrl; anchor.download = `comprovante-evento-${checkout?.registrationNumber ?? "inscricao"}.pdf`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000); }); }

  const timerLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const complete = checkout?.registrationStatus === "CONFIRMED";

  return <S.PublicShell><S.PublicCard>
    <S.PublicHero $image={event.bannerUrl}><div><span>Inscrições abertas</span><h1>{event.name}</h1><p>{event.description || "Participe deste evento."}</p></div></S.PublicHero>
    <S.CheckoutStepper aria-label={`Etapa ${step} de 3`}>{[{ id: 1, label: "Dados e itens", icon: Ticket }, { id: 2, label: "Pagamento", icon: Smartphone }, { id: 3, label: "Comprovante", icon: CheckCircle2 }].map((item) => { const Icon = item.icon; const done = item.id < step || (item.id === 2 && selectedTotal <= 0 && step === 3); return <div key={item.id} aria-current={step === item.id ? "step" : undefined} data-done={done}><span>{done ? <Check /> : <Icon />}</span><div><small>Etapa {item.id}</small><strong>{item.label}</strong></div></div>; })}</S.CheckoutStepper>
    <S.PublicContent><section>
      {notice ? <S.Notice $danger={notice.danger} role="status">{notice.message}</S.Notice> : null}
      {step === 1 ? <S.CheckoutPanel><S.PublicStepHeading><small>ETAPA 1 DE 3</small><h2>Seus dados e escolhas</h2><p>Preencha os dados do participante e selecione o que deseja incluir.</p></S.PublicStepHeading>
        {isRegistrationOpen ? <form onSubmit={submitRegistration}><div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}><label>Não preencha<input name="website" tabIndex={-1} autoComplete="off" /></label></div><S.FieldGrid>
          <S.Wide><S.Field><span>Nome completo *</span><input name="participantName" autoComplete="name" required minLength={3} aria-invalid={Boolean(fieldErrors.participantName)} />{fieldErrors.participantName?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Field></S.Wide>
          <S.Field><span>Sexo *</span><select name="participantGender" required defaultValue=""><option value="" disabled>Selecione uma opção</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select>{fieldErrors.participantGender?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Field>
          <S.Field><span>Telefone *</span><input name="participantPhone" autoComplete="tel" inputMode="tel" required placeholder="(00) 00000-0000" onChange={(change) => { change.currentTarget.value = formatBrazilPhone(change.currentTarget.value); }} />{fieldErrors.participantPhone?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Field>
          <S.Field><span>Regional</span><select value={regionId} onChange={(change) => setRegionId(change.target.value)}><option value="">Sem regional</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>
          <S.Field><span>Congregação</span><select name="congregationId" defaultValue=""><option value="">Sem congregação</option>{filteredCongregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field>
          {items.length ? <S.Wide><fieldset><S.FieldLegend>Selecione os itens</S.FieldLegend><S.PublicItemCards>{items.map((item) => { const Icon = itemIcons[item.item_type] ?? Ticket; const checked = selected.has(item.id); const soldOut = item.available_quantity === 0; return <S.PublicItemCard key={item.id} $selected={checked} data-disabled={soldOut}><input type="checkbox" checked={checked} disabled={item.is_required || soldOut} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(item.id) && !item.is_required) next.delete(item.id); else next.add(item.id); return next; })} aria-label={`Selecionar ${item.name}`} /><span><Icon /></span><div><strong>{item.name}</strong>{item.description ? <p>{item.description}</p> : null}<small>{soldOut ? "Esgotado" : `${money(item.price)}${item.is_required ? " · obrigatório" : ""}`}</small></div>{checked ? <CheckCircle2 /> : null}{checked && item.allow_quantity ? <S.QuantityControl><button type="button" onClick={(click) => { click.preventDefault(); changeQuantity(item, -1); }} aria-label={`Diminuir ${item.name}`}><Minus /></button><b>{quantities[item.id] ?? 1}</b><button type="button" onClick={(click) => { click.preventDefault(); changeQuantity(item, 1); }} aria-label={`Aumentar ${item.name}`}><Plus /></button></S.QuantityControl> : null}</S.PublicItemCard>; })}</S.PublicItemCards></fieldset></S.Wide> : null}
          {selectedTotal > 0 ? <S.Wide><fieldset><S.FieldLegend>Como pretende realizar o pagamento?</S.FieldLegend><S.PaymentChoices>{methodOptions.map((method) => { const Icon = method.icon; return <label key={method.value} data-selected={paymentMethod === method.value}><input type="radio" name="paymentMethod" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)} /><span><Icon /></span><div><strong>{method.label}</strong><small>{method.description}</small></div>{paymentMethod === method.value ? <CheckCircle2 /> : null}</label>; })}</S.PaymentChoices></fieldset></S.Wide> : null}
          <S.Wide><S.Check><input type="checkbox" name="consentAccepted" required /><span>Confirmo que forneci estes dados e aceito o aviso de privacidade para a operação deste evento.</span></S.Check>{fieldErrors.consentAccepted?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Wide>
        </S.FieldGrid><S.PublicActions><span /><Button type="submit" loading={pending}>{selectedTotal <= 0 ? "Confirmar inscrição" : "Continuar para pagamento"}<ArrowRight size={16} /></Button></S.PublicActions></form> : <S.Notice $danger>As inscrições não estão abertas neste momento.</S.Notice>}
      </S.CheckoutPanel> : null}

      {step === 2 ? <S.CheckoutPanel>
        <S.PublicStepHeading>
          <small>ETAPA 2 DE 3</small>
          <h2>{activeMethod === "PIX" ? "Pagamento por Pix" : "Pagamento presencial"}</h2>
          <p>{activeMethod === "PIX"
            ? checkout?.paymentSimulationEnabled
              ? "Teste o fluxo completo com um Pix simulado, sem cobrança real."
              : "Gere o Pix e acompanhe a confirmação sem sair desta página."
            : "Sua escolha foi registrada e será confirmada pela organização."}</p>
        </S.PublicStepHeading>
        {activeMethod === "PIX" && checkout?.paymentSimulationEnabled ? <S.SimulationNotice role="status">
          <span><ShieldCheck /></span>
          <div><strong>Ambiente de simulação</strong><p>Nenhuma cobrança será enviada ao Mercado Pago ou a um banco. Os dados e o comprovante serão criados apenas para testar o módulo.</p></div>
        </S.SimulationNotice> : null}
        {activeMethod === "PIX" ? !pix ? <form onSubmit={generatePix}>
          <S.PixIntro><span><ShieldCheck /></span><div><strong>{checkout?.paymentSimulationEnabled ? "Dados para o cenário de teste" : "Dados usados somente para gerar o Pix"}</strong><p>{checkout?.paymentSimulationEnabled ? "Use um e-mail e CPF válidos apenas para percorrer as mesmas validações do fluxo real." : "O Mercado Pago exige o e-mail e o CPF do pagador. Eles não alteram seu cadastro de membro."}</p></div></S.PixIntro>
          <S.FieldGrid>
            <S.Field><span>E-mail do pagador *</span><input type="email" value={payerEmail} onChange={(change) => setPayerEmail(change.target.value)} autoComplete="email" required placeholder="voce@exemplo.com" />{fieldErrors.payerEmail?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Field>
            <S.Field><span>CPF do pagador *</span><input value={payerCpf} onChange={(change) => setPayerCpf(formatCpf(change.target.value))} inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" />{fieldErrors.payerCpf?.map((error) => <S.ErrorText key={error}>{error}</S.ErrorText>)}</S.Field>
          </S.FieldGrid>
          <S.PublicActions><Button type="button" variant="outline" onClick={() => setStep(1)} disabled={pending}><ArrowLeft size={16} />Voltar</Button><Button type="submit" loading={pending}><QrCodeIcon size={16} />{checkout?.paymentSimulationEnabled ? "Gerar Pix de teste" : "Gerar Pix"}</Button></S.PublicActions>
        </form> : <S.PixLayout><S.PixCodePanel>
          <S.PixStatus><span><Clock3 /></span><div><small>SITUAÇÃO</small><strong>{pix.isSimulated ? "Aguardando aprovação de teste" : "Aguardando pagamento"}</strong></div><time>{timerLabel}</time></S.PixStatus>
          {pix.qrCodeBase64 ? <Image unoptimized width={230} height={230} src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code para pagamento Pix" /> : pix.isSimulated && pix.qrCode ? <S.SimulatedQr><QrCode value={pix.qrCode} size={230} /></S.SimulatedQr> : null}
          <h3>{pix.isSimulated ? "QR Code Pix simulado" : "Escaneie o QR Code"}</h3>
          <p>{pix.isSimulated ? "Este código é apenas visual e não deve ser lido ou pago em um aplicativo bancário." : "Abra o aplicativo do seu banco, escolha Pix e aponte a câmera para o código."}</p>
          {pix.qrCode ? <S.PixCopy><code>{pix.qrCode}</code><Button type="button" onClick={copyPix} variant="outline"><Copy size={15} />{pix.isSimulated ? "Copiar código de teste" : "Copiar código Pix"}</Button></S.PixCopy> : null}
          <S.PixHelp>{pix.isSimulated ? <><b>1</b><span>Confira o QR Code e o código fictícios</span><b>2</b><span>Use a opção de copiar para testar a interação</span><b>3</b><span>Clique em seguir para simular a aprovação</span></> : <><b>1</b><span>Abra o app do banco</span><b>2</b><span>Escolha pagar com Pix</span><b>3</b><span>Confirme o valor e conclua</span></>}</S.PixHelp>
          {secondsLeft <= 0 ? <S.Notice $danger>Este Pix expirou. Gere uma nova cobrança para continuar.</S.Notice> : null}
          <Button type="button" fullWidth loading={pending} onClick={secondsLeft <= 0 ? () => { setPix(null); pixIdempotency.current = `pix_${crypto.randomUUID()}`; } : pix.isSimulated ? approveSimulatedPayment : refreshStatus}>{secondsLeft <= 0 ? "Gerar novo Pix" : pix.isSimulated ? "Seguir e aprovar pagamento de teste" : "Já paguei — verificar novamente"}</Button>
        </S.PixCodePanel></S.PixLayout> : <S.ManualPayment><span><Banknote /></span><h3>Inscrição recebida</h3><p>Você escolheu pagar com <strong>{methodLabel(activeMethod)}</strong>. O pagamento será recebido e confirmado pela organização do evento.</p><div><LockKeyhole /><span>A credencial será liberada após a confirmação do pagamento.</span></div><Button onClick={() => setStep(3)}>Ver protocolo da inscrição<ArrowRight size={16} /></Button></S.ManualPayment>}
      </S.CheckoutPanel> : null}

      {step === 3 && checkout ? <S.ConfirmationPanel><S.ConfirmationHeader data-pending={!complete}><span>{complete ? <CheckCircle2 /> : <Clock3 />}</span><div><small>{complete ? "INSCRIÇÃO CONFIRMADA" : "INSCRIÇÃO RECEBIDA"}</small><h2>{complete ? "Tudo certo!" : "Aguardando confirmação"}</h2><p>{complete ? "Guarde seu comprovante e apresente a credencial na entrada." : "Seu protocolo foi gerado. A credencial será liberada após o pagamento."}</p></div></S.ConfirmationHeader><S.ReceiptGrid><S.ReceiptCard><header><div><small>COMPROVANTE DE INSCRIÇÃO</small><strong>{checkout.eventName}</strong></div><Ticket /></header><dl><div><dt>Participante</dt><dd>{checkout.participantName}</dd></div><div><dt>Número</dt><dd>{checkout.registrationNumber}</dd></div><div><dt>Pagamento</dt><dd>{methodLabel(checkout.paymentMethod)}</dd></div><div><dt>Situação</dt><dd>{complete ? "Confirmada" : "Pendente"}</dd></div></dl><footer><span>Total</span><strong>{money(checkout.totalAmount)}</strong></footer></S.ReceiptCard><S.CredentialCard data-locked={!checkout.credentialToken}><header><small>CREDENCIAL DO EVENTO</small><strong>{checkout.eventName}</strong></header>{checkout.credentialToken ? <><QrCode value={checkout.credentialToken} size={176} /><h3>{checkout.participantName}</h3><p>{checkout.registrationNumber}{checkout.congregationName ? ` · ${checkout.congregationName}` : ""}</p><footer>Apresente esta credencial na entrada</footer></> : <S.CredentialLocked><span><LockKeyhole /></span><h3>Credencial bloqueada</h3><p>Ela ficará disponível assim que o pagamento for confirmado.</p></S.CredentialLocked>}</S.CredentialCard></S.ReceiptGrid><S.PublicActions>{!complete && checkout.paymentMethod === "PIX" ? <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={16} />Voltar ao Pix</Button> : <span />}{complete ? <div><Button variant="outline" onClick={() => window.print()}><Printer size={16} />Imprimir</Button><Button onClick={downloadReceipt} loading={pending}><Download size={16} />Baixar comprovante em PDF</Button></div> : <Button onClick={refreshStatus} loading={pending}>Verificar confirmação</Button>}</S.PublicActions></S.ConfirmationPanel> : null}
    </section><S.PublicAside><S.EventInfoCard><h3>Informações do evento</h3><p><CalendarDays /><span>{date(event.startsAt)}</span></p><p><MapPin /><span>{[event.location, event.city, event.state].filter(Boolean).join(" · ") || "Local a definir"}</span></p><p><ShieldCheck /><span>Ambiente seguro para sua inscrição.</span></p></S.EventInfoCard><S.CartSummary aria-live="polite"><h3>Resumo da inscrição</h3>{selectedItems.length ? <ul>{selectedItems.map((item) => <li key={item.id}><span>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span><strong>{money(item.price * item.quantity)}</strong></li>)}</ul> : checkout?.items.length ? <ul>{checkout.items.map((item) => <li key={item.id}><span>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span><strong>{money(item.totalPrice)}</strong></li>)}</ul> : <p>Nenhum item selecionado.</p>}<footer><span>Total</span><strong>{money(checkout?.totalAmount ?? selectedTotal)}</strong></footer>{(checkout || step > 1) ? <S.SummaryMeta><span>Forma de pagamento</span><strong>{methodLabel(activeMethod)}</strong>{checkout ? <><span>Situação</span><strong>{complete ? "Confirmada" : "Pendente"}</strong></> : null}</S.SummaryMeta> : null}</S.CartSummary></S.PublicAside></S.PublicContent>
  </S.PublicCard>{pending ? <S.ScreenReaderStatus role="status"><LoaderCircle />Processando</S.ScreenReaderStatus> : null}</S.PublicShell>;
}
