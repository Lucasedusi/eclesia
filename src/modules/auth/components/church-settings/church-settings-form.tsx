"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateChurchSettingsAction } from "../../actions/church-settings.actions";
import { INITIAL_ACTION_STATE } from "../../types/auth.types";

type Values = Record<string, string | number | null>;

export function ChurchSettingsForm({ values, canUpdate }: { values: Values; canUpdate: boolean }) {
  const [state, action, pending] = useActionState(updateChurchSettingsAction, INITIAL_ACTION_STATE);
  const field = (name:string,label:string,type="text") => <label className="grid gap-2"><span className="text-[11px] font-extrabold text-slate-600">{label}</span><input disabled={!canUpdate} type={type} name={name} defaultValue={String(values[name] ?? "")} className="min-h-[50px] rounded-[10px] border border-[#D9DEEA] bg-[#F8F9FC] px-4 text-[13px] font-semibold text-slate-700 outline-none focus:border-[#415BA5] focus:bg-white focus:ring-4 focus:ring-[#415BA5]/10 disabled:opacity-70"/>{state.fieldErrors?.[name]?.[0]?<small className="font-bold text-red-500">{state.fieldErrors[name][0]}</small>:null}</label>;
  return <form action={action} className="rounded-[20px] border border-[#EAECF0] bg-white p-6 shadow-[var(--shadow-card)]">
    {state.status!=="idle"?<div className={`mb-5 rounded-[10px] border px-4 py-3 text-xs font-bold ${state.status==="success"?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-red-200 bg-red-50 text-red-700"}`}>{state.message}</div>:null}
    <div className="mb-6"><h2 className="m-0 text-base font-extrabold text-slate-900">Identificação institucional</h2><p className="mt-1 text-xs font-medium text-slate-500">Dados principais exibidos no ambiente e nos relatórios.</p></div>
    <div className="grid gap-5 md:grid-cols-2">{field("name","Nome da igreja ou campo")}{field("displayName","Nome de exibição")}{field("legalName","Razão social")}{field("document","CNPJ ou documento")}{field("email","E-mail","email")}{field("phone","Telefone")}{field("whatsapp","WhatsApp")}{field("seniorPastorName","Pastor Presidente")}{field("seniorPastorSpouseName","Cônjuge do Pastor Presidente")}</div>
    <div className="my-7 border-t border-[#EAECF0]"/><div className="mb-5"><h2 className="m-0 text-base font-extrabold text-slate-900">Código automático dos membros</h2></div>
    <div className="grid gap-5 md:grid-cols-2">{field("memberCodePrefix","Prefixo")}{field("memberCodePadding","Quantidade de dígitos","number")}</div>
    {canUpdate?<div className="mt-6 flex justify-end"><button className="app-button-primary" disabled={pending} type="submit"><Save size={16}/>{pending?"Salvando...":"Salvar configurações"}</button></div>:<p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">Seu acesso permite consultar, mas não alterar estas configurações.</p>}
  </form>;
}
