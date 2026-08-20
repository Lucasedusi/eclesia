"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Eye,
  ImageUp,
  Info,
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
  prepareEventBannerAction,
  removeEventBannerAction,
  saveEventAction,
} from "../actions/event.actions";
import { EVENT_SCOPES, EVENT_TYPES, EVENT_VISIBILITIES, REGISTRATION_MODES, eventLabel } from "../constants/events";
import type { EventDetail, EventScope } from "../types/event.types";
import * as S from "./events.styles";

type Reference = { id: string; name: string; region_id?: string | null };
type Props = { initial?: EventDetail; options: { regions: Reference[]; congregations: Reference[]; ministries: Reference[] } };

const steps = [
  { title: "Informações gerais", description: "Identificação e apresentação", icon: Info },
  { title: "Data e local", description: "Agenda e endereço", icon: CalendarClock },
  { title: "Escopo", description: "Público interno alcançado", icon: ShieldCheck },
  { title: "Inscrições e vagas", description: "Período e capacidade", icon: ClipboardCheck },
  { title: "Grupos", description: "Regras para caravanas", icon: Users },
  { title: "Itens e pagamentos", description: "Cobranças do evento", icon: CreditCard },
  { title: "Página pública e revisão", description: "Banner e conferência final", icon: Eye },
] as const;

const fieldStep: Record<string, number> = {
  name: 0, slug: 0, description: 0, eventType: 0, visibility: 0,
  startsAt: 1, endsAt: 1, locationName: 1, zipCode: 1, address: 1, number: 1, complement: 1, district: 1, city: 1, state: 1, country: 1,
  eventScope: 2, regionId: 2, congregationId: 2, ministryId: 2,
  registrationStartsAt: 3, registrationEndsAt: 3, registrationMode: 3, capacity: 3,
  requiresGroupResponsible: 4, requiresPastorInfo: 4, requiresGenderTotals: 4,
  requiresPayment: 5, notes: 6,
};

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
  const [groupResponsible, setGroupResponsible] = useState(initial?.requiresGroupResponsible ?? false);
  const [pastorInfo, setPastorInfo] = useState(initial?.requiresPastorInfo ?? false);
  const [genderTotals, setGenderTotals] = useState(initial?.requiresGenderTotals ?? false);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const bannerPreview = useMemo(() => banner ? URL.createObjectURL(banner) : removeBanner ? null : initial?.bannerUrl ?? null, [banner, initial?.bannerUrl, removeBanner]);

  useEffect(() => () => { if (bannerPreview?.startsWith("blob:")) URL.revokeObjectURL(bannerPreview); }, [bannerPreview]);

  function submit(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const data = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    data.id = initial?.id ?? "";
    data.slug = slug;
    data.requiresPayment = requiresPayment;
    data.requiresGroupResponsible = groupResponsible;
    data.requiresPastorInfo = pastorInfo;
    data.requiresGenderTotals = genderTotals;

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
      router.push(`/eventos/${id}`);
      router.refresh();
    });
  }

  return (
    <S.Module>
      <PageHeader
        title={initial ? "Editar evento" : "Novo evento"}
        subtitle="Preencha as etapas no seu ritmo. Os dados permanecem salvos no formulário ao avançar ou voltar."
        action={<Link href={initial ? `/eventos/${initial.id}` : "/eventos"} className="app-button-secondary"><ArrowLeft size={16} />Voltar</Link>}
      />
      {notice ? <S.Notice $danger={notice.danger} role="alert">{notice.message}</S.Notice> : null}

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

        <form ref={formRef} onSubmit={(event) => event.preventDefault()} noValidate>
          <input type="hidden" name="timezone" value="America/Sao_Paulo" />
          <S.WizardContent>
            <S.StepHeading>
              <span>Cadastro multifases</span>
              <h2>{initial ? "Editar evento" : "Ficha cadastral do evento"}</h2>
              <p>Etapa {step + 1} de {steps.length}. Os dados permanecem preenchidos ao avançar ou voltar.</p>
            </S.StepHeading>

            <S.WizardBody>
              <S.InnerStepHeading>
                <span>{steps[step].title}</span>
                <h3>{steps[step].title}</h3>
                <p>{steps[step].description}</p>
              </S.InnerStepHeading>

            <S.StepPanel hidden={step !== 0}>
              <S.FieldGrid>
                <S.Field><span>Nome do evento *</span><input name="name" defaultValue={initial?.name ?? ""} minLength={3} onChange={(event) => { if (!slugTouched) setSlug(slugify(event.target.value)); }} /></S.Field>
                <S.Field><span>Link amigável</span><input value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} placeholder="nome-do-evento" /></S.Field>
                <S.Field><span>Tipo</span><select name="eventType" defaultValue={initial?.eventType ?? "OTHER"}>{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Field><span>Visibilidade</span><select name="visibility" defaultValue={initial?.visibility ?? "INTERNAL"}>{EVENT_VISIBILITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Wide><S.Field><span>Descrição</span><textarea name="description" defaultValue={initial?.description ?? ""} maxLength={5000} /></S.Field></S.Wide>
              </S.FieldGrid>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 1}>
              <S.FieldGrid>
                <S.Field><span>Início *</span><input type="datetime-local" name="startsAt" defaultValue={localDate(initial?.startsAt)} /></S.Field>
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
                {scope === "REGION" ? <S.Field><span>Regional *</span><select name="regionId" defaultValue={initial?.regionId ?? ""}><option value="">Selecione</option>{options.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="regionId" value="" />}
                {scope === "CONGREGATION" ? <S.Field><span>Congregação *</span><select name="congregationId" defaultValue={initial?.congregationId ?? ""}><option value="">Selecione</option>{options.congregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="congregationId" value="" />}
                {scope === "MINISTRY" ? <S.Field><span>Ministério *</span><select name="ministryId" defaultValue={initial?.ministryId ?? ""}><option value="">Selecione</option>{options.ministries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field> : <input type="hidden" name="ministryId" value="" />}
              </S.FieldGrid>
              <S.InfoBox><ShieldCheck /><div><strong>Isolamento de acesso</strong><p>O escopo limita a operação aos usuários autorizados para a igreja, regional, congregação ou ministério selecionado.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 3}>
              <S.FieldGrid>
                <S.Field><span>Abertura das inscrições</span><input type="datetime-local" name="registrationStartsAt" defaultValue={localDate(initial?.registrationStartsAt)} /></S.Field>
                <S.Field><span>Encerramento das inscrições</span><input type="datetime-local" name="registrationEndsAt" defaultValue={localDate(initial?.registrationEndsAt)} /></S.Field>
                <S.Field><span>Modo de inscrição</span><select name="registrationMode" defaultValue={initial?.registrationMode ?? "INDIVIDUAL"}>{REGISTRATION_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
                <S.Field><span>Capacidade total</span><input type="number" name="capacity" min={0} defaultValue={initial?.capacity ?? ""} placeholder="Sem limite" /></S.Field>
              </S.FieldGrid>
              <S.InfoBox><ClipboardCheck /><div><strong>Fluxo direto</strong><p>Ao atingir a capacidade, novas inscrições serão impedidas. Este módulo não utiliza lista de espera.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 4}>
              <S.CardChoices>
                <S.OptionCard $selected={groupResponsible}><input type="checkbox" checked={groupResponsible} onChange={(event) => setGroupResponsible(event.target.checked)} /><span><Users /></span><div><strong>Responsável do grupo</strong><small>Solicitar uma pessoa responsável pela caravana.</small></div><Check /></S.OptionCard>
                <S.OptionCard $selected={pastorInfo}><input type="checkbox" checked={pastorInfo} onChange={(event) => setPastorInfo(event.target.checked)} /><span><ShieldCheck /></span><div><strong>Dados do pastor</strong><small>Solicitar a identificação pastoral do grupo.</small></div><Check /></S.OptionCard>
                <S.OptionCard $selected={genderTotals}><input type="checkbox" checked={genderTotals} onChange={(event) => setGenderTotals(event.target.checked)} /><span><Users /></span><div><strong>Totais por sexo</strong><small>Controlar os totais informados pela caravana.</small></div><Check /></S.OptionCard>
              </S.CardChoices>
              <S.InfoBox><Info /><div><strong>Metas por congregação</strong><p>As metas de inscrições são cadastradas depois de salvar o evento, na aba Cotas do workspace. Elas não bloqueiam novas inscrições.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 5}>
              <S.CardChoices>
                <S.OptionCard $selected={requiresPayment}><input type="checkbox" checked={requiresPayment} onChange={(event) => setRequiresPayment(event.target.checked)} /><span><CreditCard /></span><div><strong>Evento exige pagamento</strong><small>Permite informar a forma preferida na inscrição e registrar pagamentos individuais.</small></div><Check /></S.OptionCard>
              </S.CardChoices>
              <S.InfoBox><CreditCard /><div><strong>Configuração simplificada</strong><p>Itens são cadastrados no workspace. Não há lotes, parcelamento ou limite de parcelas.</p></div></S.InfoBox>
            </S.StepPanel>

            <S.StepPanel hidden={step !== 6}>
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
