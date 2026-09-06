"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Eye,
  ImageUp,
  Info,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  finalizeEventBannerAction,
  finalizeEventPixQrAction,
  prepareEventBannerAction,
  prepareEventPixQrAction,
  removeEventBannerAction,
  removeEventPixQrAction,
  saveEventAction,
} from "../actions/event.actions";
import { EVENT_SCOPES, EVENT_TYPES, EVENT_VISIBILITIES, REGISTRATION_MODES, eventLabel } from "../constants/events";
import type { EventDetail, EventRegistrationFieldRow, EventScope } from "../types/event.types";
import { orderRegistrationFields } from "../utils/registration-fields";
import * as S from "./events.styles";

type Reference = { id: string; name: string; region_id?: string | null; item_type?:string; price?:number };
type Props = { initial?: EventDetail; options: { regions: Reference[]; congregations: Reference[]; ministries: Reference[]; items:Reference[] } };

const steps = [
  { title: "Informações gerais", description: "Identificação e apresentação", icon: Info },
  { title: "Data e local", description: "Agenda e endereço", icon: CalendarClock },
  { title: "Escopo", description: "Público interno alcançado", icon: ShieldCheck },
  { title: "Inscrições e vagas", description: "Modo, capacidade e abertura manual", icon: ClipboardCheck },
  { title: "Formulário de inscrição", description: "Campos padrão e personalizados", icon: ClipboardCheck },
  { title: "Caravanas", description: "Cadastro e pagamento coletivo", icon: Users },
  { title: "Itens e pagamentos", description: "Cobranças do evento", icon: CreditCard },
  { title: "Página pública e revisão", description: "Banner e conferência final", icon: Eye },
] as const;

const fieldStep: Record<string, number> = {
  name: 0, slug: 0, description: 0, eventType: 0, visibility: 0,
  startsAt: 1, endsAt: 1, locationName: 1, zipCode: 1, address: 1, number: 1, complement: 1, district: 1, city: 1, state: 1, country: 1,
  eventScope: 2, regionId: 2, congregationId: 2, ministryId: 2,
  registrationMode: 3, capacity: 3, registrationFields: 4,
  requiresGroupResponsible: 5, requiresPastorInfo: 5, requiresGenderTotals: 5,
  requiresPayment: 6, notes: 7,
};

const defaultRegistrationFields: EventRegistrationFieldRow[] = [
  ["participant_name", "Nome completo", "SHORT_TEXT", "REQUIRED", true],
  ["participant_gender", "Sexo", "SINGLE_SELECT", "REQUIRED", false],
  ["participant_phone", "Telefone", "SHORT_TEXT", "REQUIRED", false],
  ["participant_email", "E-mail", "SHORT_TEXT", "HIDDEN", false],
  ["participant_document", "Documento", "SHORT_TEXT", "HIDDEN", false],
  ["participant_birth_date", "Data de nascimento", "DATE", "HIDDEN", false],
  ["region_id", "Regional", "SINGLE_SELECT", "OPTIONAL", false],
  ["congregation_id", "Congregação", "SINGLE_SELECT", "OPTIONAL", false],
  ["participant_role_id", "Cargo", "SINGLE_SELECT", "OPTIONAL", false],
  ["participant_city", "Cidade", "SHORT_TEXT", "HIDDEN", false],
  ["participant_state", "UF", "SHORT_TEXT", "HIDDEN", false],
  ["responsible_name", "Nome do responsável", "SHORT_TEXT", "HIDDEN", false],
  ["responsible_phone", "Telefone do responsável", "SHORT_TEXT", "HIDDEN", false],
  ["preferred_payment_method", "Forma de pagamento", "SINGLE_SELECT", "OPTIONAL", true],
  ["items", "Itens do evento", "SINGLE_SELECT", "OPTIONAL", true],
].map(([key, label, type, visibility, locked], index) => ({
  id: "", key, kind: "STANDARD", label, helpText: null, type, visibility,
  options: type === "SINGLE_SELECT" ? (key === "participant_gender" ? ["MALE", "FEMALE"] : ["REFERENCE"]) : [],
  sortOrder: (index + 1) * 10, active: visibility !== "HIDDEN", systemLocked: locked,
}) as EventRegistrationFieldRow);

function localDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
}

export function EventForm({ initial, options }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<EventScope>(initial?.scope ?? "CHURCH");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [requiresPayment, setRequiresPayment] = useState(initial?.requiresPayment ?? false);
  const [registrationMode,setRegistrationMode]=useState(initial?.registrationMode==="GROUP"?"MIXED":initial?.registrationMode??"INDIVIDUAL");
  const [allowParticipantList,setAllowParticipantList]=useState(initial?.paymentSettings.allowParticipantList??true);
  const [pixEnabled,setPixEnabled]=useState(initial?.paymentSettings.pixEnabled??false);
  const [cashEnabled,setCashEnabled]=useState(initial?.paymentSettings.cashEnabled??false);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [banner, setBanner] = useState<File | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [pixQr,setPixQr]=useState<File|null>(null);
  const [removePixQr,setRemovePixQr]=useState(false);
  const [registrationFields, setRegistrationFields] = useState<EventRegistrationFieldRow[]>(() => orderRegistrationFields(initial?.registrationFields.length ? initial.registrationFields : defaultRegistrationFields));
  const activeCustomFieldCount = registrationFields.filter((field) => field.kind === "CUSTOM" && field.active && field.visibility !== "HIDDEN").length;
  const bannerPreview = useMemo(() => banner ? URL.createObjectURL(banner) : removeBanner ? null : initial?.bannerUrl ?? null, [banner, initial?.bannerUrl, removeBanner]);
  const pixQrPreview=useMemo(()=>pixQr?URL.createObjectURL(pixQr):removePixQr?null:initial?.paymentSettings.pixQrUrl??null,[initial?.paymentSettings.pixQrUrl,pixQr,removePixQr]);

  useEffect(() => () => { if (bannerPreview?.startsWith("blob:")) URL.revokeObjectURL(bannerPreview); }, [bannerPreview]);
  useEffect(()=>()=>{if(pixQrPreview?.startsWith("blob:"))URL.revokeObjectURL(pixQrPreview);},[pixQrPreview]);

  function submit(formElement: HTMLFormElement) {
    setSubmitAttempted(true);
    const invalidField = Array.from(formElement.elements).find((element) =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.checkValidity(),
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
    if (invalidField) {
      setStep(fieldStep[invalidField.name] ?? 0);
      setNotice({ message: "Preencha os campos obrigatórios destacados em vermelho.", danger: true });
      window.requestAnimationFrame(() => invalidField.focus());
      return;
    }
    const form = new FormData(formElement);
    const data = Object.fromEntries(form.entries()) as Record<string, unknown>;
    data.id = initial?.id ?? "";
    data.slug = slug;
    data.requiresPayment = requiresPayment;
    data.requiresGroupResponsible = registrationMode==="MIXED";
    data.requiresPastorInfo = registrationMode==="MIXED";
    data.requiresGenderTotals = registrationMode==="MIXED";
    data.registrationMode=registrationMode;
    data.caravanSettings={
      allowParticipantList,pixEnabled,cashEnabled,
      caravanRegistrationItemId:String(form.get("caravanRegistrationItemId")??""),
      pixKey:String(form.get("pixKey")??""),pixHolderName:String(form.get("pixHolderName")??""),
      whatsappNumber:String(form.get("whatsappNumber")??""),paymentInstructions:String(form.get("paymentInstructions")??""),
    };
    data.registrationFields = registrationFields.map((field, index) => ({ ...field, sortOrder: (index + 1) * 10, helpText: field.helpText ?? "" }));

    const activeCustomCount = registrationFields.filter((field) => field.kind === "CUSTOM" && field.active && field.visibility !== "HIDDEN").length;
    if (activeCustomCount > 20) {
      setStep(4);
      setNotice({ message: "O formulário aceita no máximo 20 campos personalizados ativos.", danger: true });
      return;
    }

    startTransition(async () => {
      setNotice(null);
      const result = await saveEventAction(data);
      if (result.status === "error") {
        const firstField = Object.keys(result.fieldErrors ?? {})[0];
        if (firstField) setStep(fieldStep[firstField] ?? 0);
        setNotice({ message: result.message, danger: true });
        return;
      }
      const id = result.data.id;
      if (removeBanner && initial?.bannerUrl) {
        const removed = await removeEventBannerAction(id);
        if (removed.status === "error") {
          setNotice({ message: `Evento salvo, mas o banner não foi removido: ${removed.message}`, danger: true });
          return;
        }
      }
      if (banner) {
        const prepared = await prepareEventBannerAction(id, { name: banner.name, type: banner.type, size: banner.size });
        if (prepared.status === "error") {
          setNotice({ message: `Evento salvo, mas o banner falhou: ${prepared.message}`, danger: true });
          return;
        }
        const upload = await createClient().storage.from("event-public-media").uploadToSignedUrl(prepared.data.path, prepared.data.token, banner, { contentType: banner.type });
        if (upload.error) {
          setNotice({ message: "Evento salvo, mas não foi possível enviar o banner.", danger: true });
          return;
        }
        const finalized = await finalizeEventBannerAction(id, prepared.data.path);
        if (finalized.status === "error") {
          setNotice({ message: finalized.message, danger: true });
          return;
        }
      }
      if(removePixQr&&initial?.paymentSettings.pixQrUrl){
        const removed=await removeEventPixQrAction(id);
        if(removed.status==="error"){setNotice({message:`Evento salvo, mas o QR Code Pix não foi removido: ${removed.message}`,danger:true});return;}
      }
      if(pixQr){
        const prepared=await prepareEventPixQrAction(id,{name:pixQr.name,type:pixQr.type,size:pixQr.size});
        if(prepared.status==="error"){setNotice({message:`Evento salvo, mas o QR Code Pix falhou: ${prepared.message}`,danger:true});return;}
        const upload=await createClient().storage.from("event-public-media").uploadToSignedUrl(prepared.data.path,prepared.data.token,pixQr,{contentType:pixQr.type});
        if(upload.error){setNotice({message:"Evento salvo, mas não foi possível enviar o QR Code Pix.",danger:true});return;}
        const finalized=await finalizeEventPixQrAction(id,prepared.data.path,pixQr.name);
        if(finalized.status==="error"){setNotice({message:finalized.message,danger:true});return;}
      }
      router.push(`/eventos/${id}`);
      router.refresh();
    });
  }

  function updateRegistrationField(key: string, patch: Partial<EventRegistrationFieldRow>) {
    setRegistrationFields((current) => current.map((field) => field.key === key ? { ...field, ...patch } : field));
  }

  function moveRegistrationField(index: number, direction: -1 | 1) {
    setRegistrationFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addCustomField() {
    if (activeCustomFieldCount >= 20) {
      setNotice({ message: "O formulário aceita no máximo 20 campos personalizados ativos.", danger: true });
      return;
    }
    const key = `custom_${Date.now().toString(36)}`;
    setRegistrationFields((current) => [...current, {
      id: "", key, kind: "CUSTOM", label: "Novo campo", helpText: null, type: "SHORT_TEXT",
      visibility: "OPTIONAL", options: [], sortOrder: (current.length + 1) * 10, active: true, systemLocked: false,
    }]);
  }

  function removeCustomField(field: EventRegistrationFieldRow) {
    setRegistrationFields((current) => field.id
      ? current.map((item) => item.key === field.key ? { ...item, active: false, visibility: "HIDDEN" } : item)
      : current.filter((item) => item.key !== field.key));
  }

  return (
    <S.Module>
      <PageHeader
        title={initial ? "Editar evento" : "Novo evento"}
        subtitle="Configure os dados do evento e revise antes de salvar."
        action={<Link href={initial ? `/eventos/${initial.id}` : "/eventos"} className="app-button-secondary"><ArrowLeft size={16} />Voltar</Link>}
      />
      <S.Wizard>
        <S.WizardProgress>
          <header>
            <div>
              <span>Etapa {step + 1} de {steps.length}</span>
              <strong>{steps[step].title}</strong>
            </div>
            <em>{Math.round(((step + 1) / steps.length) * 100)}%</em>
          </header>
          <i><b style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></i>
          <ol>
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} data-completed={index < step}>
                    <span><Icon size={17} /></span>
                    <div><strong>{item.title}</strong><small>{item.description}</small></div>
                  </button>
                </li>
              );
            })}
          </ol>
        </S.WizardProgress>

        <form ref={formRef} onSubmit={(event) => event.preventDefault()} noValidate data-submit-attempted={submitAttempted}>
          <input type="hidden" name="timezone" value="America/Sao_Paulo" />
          <S.WizardContent>
            <S.StepHeading>
              <span>Etapa {step + 1} de {steps.length}</span>
              <h2>{steps[step].title}</h2>
              <p>{steps[step].description}</p>
            </S.StepHeading>

            <S.WizardBody>
            <S.StepPanel hidden={step !== 0}>
              <S.FieldGrid>
                <S.Field><span>Nome do evento *</span><input name="name" required defaultValue={initial?.name ?? ""} minLength={3} onChange={(event) => { if (!slugTouched) setSlug(slugify(event.target.value)); }} /></S.Field>
                <S.Field><span>Link amigável</span><input value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} placeholder="nome-do-evento" /></S.Field>
                <S.Field><span>Tipo</span><select name="eventType" defaultValue={initial?.eventType ?? "OTHER"}>{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Field><span>Visibilidade</span><select name="visibility" defaultValue={initial?.visibility ?? "INTERNAL"}>{EVENT_VISIBILITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Wide><S.Field><span>Descrição</span><textarea name="description" defaultValue={initial?.description ?? ""} maxLength={5000} /></S.Field></S.Wide>
              </S.FieldGrid>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 1}>
              <S.FieldGrid>
                <S.Field><span>Início *</span><input type="datetime-local" name="startsAt" required defaultValue={localDate(initial?.startsAt)} /></S.Field>
                <S.Field><span>Término</span><input type="datetime-local" name="endsAt" defaultValue={localDate(initial?.endsAt)} /></S.Field>
                <S.Field><span>Local</span><input name="locationName" defaultValue={initial?.location ?? ""} placeholder="Ex.: Templo Central" /></S.Field>
                <S.Field><span>CEP</span><input name="zipCode" defaultValue={initial?.zipCode ?? ""} /></S.Field>
                <S.Field><span>Endereço</span><input name="address" defaultValue={initial?.address ?? ""} /></S.Field>
                <S.Field><span>Número</span><input name="number" defaultValue={initial?.number ?? ""} /></S.Field>
                <S.Field><span>Complemento</span><input name="complement" defaultValue={initial?.complement ?? ""} /></S.Field>
                <S.Field><span>Bairro</span><input name="district" defaultValue={initial?.district ?? ""} /></S.Field>
                <S.Field><span>Cidade</span><input name="city" defaultValue={initial?.city ?? ""} /></S.Field>
                <S.Field><span>UF</span><input name="state" defaultValue={initial?.state ?? ""} maxLength={2} /></S.Field>
                <S.Field><span>País</span><input name="country" defaultValue={initial?.country ?? "Brasil"} /></S.Field>
              </S.FieldGrid>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 2}>
              <S.FieldGrid>
                <S.Field><span>Escopo do evento</span><select name="eventScope" value={scope} onChange={(event) => setScope(event.target.value as EventScope)}>{EVENT_SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                {scope === "REGION" ? <S.Field><span>Regional *</span><select name="regionId" required defaultValue={initial?.regionId ?? ""}><option value="">Selecione</option>{options.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="regionId" value="" />}
                {scope === "CONGREGATION" ? <S.Field><span>Congregação *</span><select name="congregationId" required defaultValue={initial?.congregationId ?? ""}><option value="">Selecione</option>{options.congregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="congregationId" value="" />}
                {scope === "MINISTRY" ? <S.Field><span>Ministério *</span><select name="ministryId" required defaultValue={initial?.ministryId ?? ""}><option value="">Selecione</option>{options.ministries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="ministryId" value="" />}
              </S.FieldGrid>
              <S.InfoBox><ShieldCheck /><div><strong>Isolamento de acesso</strong><p>O escopo limita a operação aos usuários autorizados para a igreja, regional, congregação ou ministério selecionado.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 3}>
              <S.FieldGrid>
                <S.Field><span>Modo de inscrição</span><select name="registrationMode" value={registrationMode} onChange={(event)=>setRegistrationMode(event.target.value)}>{REGISTRATION_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Field><span>Capacidade total</span><input type="number" name="capacity" min={0} defaultValue={initial?.capacity ?? ""} placeholder="Sem limite" /></S.Field>
              </S.FieldGrid>
              <S.InfoBox><ClipboardCheck /><div><strong>Abertura e encerramento manuais</strong><p>Publicar ou iniciar o evento não abre nem encerra inscrições. Use os comandos do workspace quando decidir receber ou interromper novos cadastros.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 4}>
              <S.FormBuilderHeader>
                <div><strong>Campos do formulário</strong><p>Defina visibilidade, obrigatoriedade e ordem. Nome, itens e pagamento possuem proteções do sistema.</p></div>
                <Button type="button" variant="outline" onClick={addCustomField} disabled={activeCustomFieldCount >= 20}><Plus size={16} />Adicionar campo</Button>
              </S.FormBuilderHeader>
              <S.FormBuilderList>
                {registrationFields.map((field, index) => (
                  <S.FormFieldCard key={field.key} data-inactive={!field.active || field.visibility === "HIDDEN"}>
                    <S.FormFieldOrder>
                      <button type="button" aria-label="Mover campo para cima" disabled={index === 0} onClick={() => moveRegistrationField(index, -1)}><ArrowUp /></button>
                      <button type="button" aria-label="Mover campo para baixo" disabled={index === registrationFields.length - 1} onClick={() => moveRegistrationField(index, 1)}><ArrowDown /></button>
                    </S.FormFieldOrder>
                    <S.FormFieldIdentity>
                      <S.Field><span>Rótulo</span><input value={field.label} minLength={2} maxLength={150} onChange={(event) => updateRegistrationField(field.key, { label: event.target.value })} /></S.Field>
                      {field.kind === "CUSTOM" ? <S.Field style={{ marginTop: 7 }}><span>Texto de ajuda</span><input value={field.helpText ?? ""} maxLength={300} placeholder="Orientação opcional para o participante" onChange={(event) => updateRegistrationField(field.key, { helpText: event.target.value })} /></S.Field> : null}
                      <small>{field.kind === "STANDARD" ? "Campo padrão" : `Personalizado · ${field.key}`}{field.systemLocked ? " · protegido" : ""}</small>
                    </S.FormFieldIdentity>
                    <S.FormFieldControl data-slot="type"><S.Field><span>Tipo</span><select value={field.type} disabled={field.kind === "STANDARD" || Boolean(field.id && initial?.hasRegistrations)} onChange={(event) => updateRegistrationField(field.key, { type: event.target.value as EventRegistrationFieldRow["type"], options: event.target.value === "SINGLE_SELECT" ? ["Opção 1"] : [] })}><option value="SHORT_TEXT">Texto curto</option><option value="LONG_TEXT">Texto longo</option><option value="DATE">Data</option><option value="NUMBER">Número</option><option value="SINGLE_SELECT">Seleção única</option><option value="BOOLEAN">Sim/Não</option></select></S.Field></S.FormFieldControl>
                    <S.FormFieldControl data-slot="visibility"><S.Field><span>Exibição</span><select value={field.visibility} disabled={field.systemLocked} onChange={(event) => updateRegistrationField(field.key, { visibility: event.target.value as EventRegistrationFieldRow["visibility"], active: event.target.value !== "HIDDEN" })}><option value="HIDDEN">Oculto</option><option value="OPTIONAL">Opcional</option><option value="REQUIRED">Obrigatório</option></select></S.Field></S.FormFieldControl>
                    <S.FormFieldControl data-slot="options">{field.kind === "CUSTOM" && field.type === "SINGLE_SELECT" ? <S.Field><span>Opções (separadas por vírgula)</span><input value={field.options.join(", ")} onChange={(event) => updateRegistrationField(field.key, { options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })} /></S.Field> : null}</S.FormFieldControl>
                    <S.FormFieldAction>{field.kind === "CUSTOM" ? <S.ActionButton type="button" $danger aria-label={`Remover ${field.label}`} onClick={() => removeCustomField(field)}><Trash2 /></S.ActionButton> : null}</S.FormFieldAction>
                  </S.FormFieldCard>
                ))}
              </S.FormBuilderList>
              <S.InfoBox><Eye /><div><strong>Prévia do cadastro</strong><p>{registrationFields.filter((field) => field.active && field.visibility !== "HIDDEN").map((field) => field.label).join(" · ") || "Nenhum campo visível"}</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 5}>
              {registrationMode==="MIXED"?<>
                <S.CardChoices>
                  <S.OptionCard $selected={allowParticipantList}><input type="checkbox" checked={allowParticipantList} onChange={(event)=>setAllowParticipantList(event.target.checked)}/><span><UploadCloud/></span><div><strong>Lista de participantes</strong><small>Permitir anexo opcional em PDF, imagem, XLSX ou DOCX.</small></div><Check/></S.OptionCard>
                  <S.OptionCard $selected={pixEnabled}><input type="checkbox" checked={pixEnabled} onChange={(event)=>setPixEnabled(event.target.checked)}/><span><CreditCard/></span><div><strong>Pix estático</strong><small>Exibir a chave Pix própria deste evento.</small></div><Check/></S.OptionCard>
                  <S.OptionCard $selected={cashEnabled}><input type="checkbox" checked={cashEnabled} onChange={(event)=>setCashEnabled(event.target.checked)}/><span><CreditCard/></span><div><strong>Dinheiro</strong><small>Permitir orientação de pagamento presencial.</small></div><Check/></S.OptionCard>
                </S.CardChoices>
                <S.FieldGrid>
                  <S.Wide><S.Field><span>Item principal da caravana</span><select name="caravanRegistrationItemId" defaultValue={initial?.paymentSettings.caravanRegistrationItemId??options.items.find((item)=>item.item_type==="REGISTRATION")?.id??""}><option value="">Selecione após cadastrar os itens</option>{options.items.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field></S.Wide>
                  {pixEnabled?<><S.Field><span>Chave Pix *</span><input name="pixKey" required defaultValue={initial?.paymentSettings.pixKey??""}/></S.Field><S.Field><span>Titular da chave *</span><input name="pixHolderName" required defaultValue={initial?.paymentSettings.pixHolderName??""}/></S.Field><S.Wide><S.UploadBox>{pixQrPreview?<Image src={pixQrPreview} alt="Prévia do QR Code Pix" width={220} height={220} unoptimized/>:<span><ImageUp/><strong>QR Code Pix do evento</strong><small>Imagem opcional em JPG, PNG ou WEBP de até 2 MB</small></span>}<div><label className="app-button-secondary"><ImageUp size={16}/>{pixQrPreview?"Substituir QR Code":"Selecionar QR Code"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{setPixQr(event.target.files?.[0]??null);setRemovePixQr(false);}}/></label>{pixQrPreview?<button type="button" className="app-button-secondary" onClick={()=>{setPixQr(null);setRemovePixQr(true);}}><Trash2 size={15}/>Remover</button>:null}</div></S.UploadBox></S.Wide></>:null}
                  <S.Field><span>WhatsApp do evento</span><input name="whatsappNumber" inputMode="tel" defaultValue={initial?.paymentSettings.whatsappNumber??""}/></S.Field>
                  <S.Wide><S.Field><span>Instruções de pagamento</span><textarea name="paymentInstructions" maxLength={1500} defaultValue={initial?.paymentSettings.paymentInstructions??""}/></S.Field></S.Wide>
                </S.FieldGrid>
                {!options.items.length?<S.InfoBox><Info/><div><strong>Item principal</strong><p>Salve o evento, cadastre os itens no workspace e volte à edição para escolher qual item acompanhará automaticamente o total da caravana.</p></div></S.InfoBox>:null}
              </>:<>
                <S.InfoBox><Users/><div><strong>Evento somente individual</strong><p>Informe o contato que será exibido depois da inscrição para combinar pagamentos presenciais.</p></div></S.InfoBox>
                <S.FieldGrid><S.Field><span>WhatsApp do evento{requiresPayment?" *":""}</span><input name="whatsappNumber" inputMode="tel" required={requiresPayment} defaultValue={initial?.paymentSettings.whatsappNumber??""}/></S.Field></S.FieldGrid>
              </>}
              <input type="hidden" name="requiresGroupResponsible" value={registrationMode==="MIXED"?"true":"false"}/><input type="hidden" name="requiresPastorInfo" value={registrationMode==="MIXED"?"true":"false"}/><input type="hidden" name="requiresGenderTotals" value={registrationMode==="MIXED"?"true":"false"}/>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 6}>
              <S.CardChoices>
                <S.OptionCard $selected={requiresPayment}><input type="checkbox" checked={requiresPayment} onChange={(event) => setRequiresPayment(event.target.checked)} /><span><CreditCard /></span><div><strong>Evento exige pagamento</strong><small>Permite informar a forma preferida na inscrição e registrar pagamentos individuais.</small></div><Check /></S.OptionCard>
              </S.CardChoices>
              <S.InfoBox><CreditCard /><div><strong>Configuração simplificada</strong><p>Itens são cadastrados no workspace. Não há lotes, parcelamento ou limite de parcelas.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 7}>
              <S.FieldGrid>
                <S.Wide>
                  <S.UploadBox>
                    {bannerPreview ? <Image src={bannerPreview} alt="Prévia do banner" width={960} height={360} unoptimized /> : <span><UploadCloud /><strong>Adicione o banner do evento</strong><small>JPG, PNG ou WEBP de até 5 MB</small></span>}
                    <div>
                      <label className="app-button-secondary"><ImageUp size={16} />{bannerPreview ? "Substituir imagem" : "Selecionar imagem"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setBanner(event.target.files?.[0] ?? null); setRemoveBanner(false); }} /></label>
                      {bannerPreview ? <button type="button" className="app-button-secondary" onClick={() => { setBanner(null); setRemoveBanner(true); }}><Trash2 size={15} />Remover</button> : null}
                    </div>
                  </S.UploadBox>
                </S.Wide>
                <S.Wide><S.Field><span>Observações internas</span><textarea name="notes" defaultValue={initial?.notes ?? ""} maxLength={3000} /></S.Field></S.Wide>
              </S.FieldGrid>
              <S.ReviewGrid>
                <div><small>Evento</small><strong>{initial?.name || "Os dados informados nas etapas anteriores"}</strong></div>
                <div><small>Tipo</small><strong>{eventLabel(EVENT_TYPES, initial?.eventType ?? "OTHER")}</strong></div>
                <div><small>Pagamento</small><strong>{requiresPayment ? "Obrigatório" : "Não obrigatório"}</strong></div>
                <div><small>Modelo operacional</small><strong>Sem lotes, fila ou parcelamento</strong></div>
              </S.ReviewGrid>
            </S.StepPanel>
            </S.WizardBody>

            <S.WizardFooter>
              <div>{step > 0 ? <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}><ChevronLeft size={16} />Voltar</Button> : <Link href={initial ? `/eventos/${initial.id}` : "/eventos"} className="app-button-secondary">Cancelar</Link>}</div>
              {step < steps.length - 1 ? <Button type="button" onClick={() => setStep((current) => current + 1)}>Continuar<ChevronRight size={16} /></Button> : <Button type="button" loading={pending} onClick={() => { if (formRef.current) submit(formRef.current); }}><Save size={16} />{initial ? "Salvar alterações" : "Salvar rascunho"}</Button>}
            </S.WizardFooter>
          </S.WizardContent>
        </form>
      </S.Wizard>

      <ToastViewport>{notice ? <Toast title={notice.danger ? "Não foi possível salvar" : "Evento salvo"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
    </S.Module>
  );
}
