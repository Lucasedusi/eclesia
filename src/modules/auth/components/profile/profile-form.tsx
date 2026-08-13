"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { updateProfileAction } from "../../actions/auth.actions";
import { INITIAL_ACTION_STATE } from "../../types/auth.types";

type Props = {
  profile: { fullName: string; displayName: string; email: string; phone: string; whatsapp: string; locale: string; timezone: string };
};

export function ProfileForm({ profile }: Props) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL_ACTION_STATE);
  const field = (name: string, label: string, value: string, type = "text") => <label className="grid gap-2"><span className="text-[11px] font-extrabold text-slate-600">{label}</span><input className="min-h-[50px] rounded-[10px] border border-[#D9DEEA] bg-[#F8F9FC] px-4 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-[#415BA5] focus:bg-white focus:ring-4 focus:ring-[#415BA5]/10" name={name} defaultValue={value} type={type}/>{state.fieldErrors?.[name]?.[0] ? <small className="font-bold text-red-500">{state.fieldErrors[name][0]}</small> : null}</label>;
  return <div className="grid gap-5 xl:grid-cols-[1fr_.36fr]">
    <form action={action} className="rounded-[20px] border border-[#EAECF0] bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="mb-6 flex items-center gap-3 border-b border-[#EAECF0] pb-5"><span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#EEF2FF] text-[#415BA5]"><UserRound size={20}/></span><div><h2 className="m-0 text-base font-extrabold text-slate-900">Dados pessoais</h2><p className="mt-1 text-xs font-medium text-slate-500">Informações exibidas dentro do sistema.</p></div></div>
      {state.status !== "idle" ? <div className={`mb-5 rounded-[10px] border px-4 py-3 text-xs font-bold ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{state.message}</div> : null}
      <div className="grid gap-5 md:grid-cols-2">{field("fullName","Nome completo",profile.fullName)}{field("displayName","Nome de exibição",profile.displayName)}{field("phone","Telefone",profile.phone)}{field("whatsapp","WhatsApp",profile.whatsapp)}<label className="grid gap-2"><span className="text-[11px] font-extrabold text-slate-600">Idioma</span><select name="locale" defaultValue={profile.locale} className="min-h-[50px] rounded-[10px] border border-[#D9DEEA] bg-[#F8F9FC] px-4 text-[13px] font-semibold text-slate-700"><option value="pt-BR">Português (Brasil)</option></select></label><label className="grid gap-2"><span className="text-[11px] font-extrabold text-slate-600">Fuso horário</span><select name="timezone" defaultValue={profile.timezone} className="min-h-[50px] rounded-[10px] border border-[#D9DEEA] bg-[#F8F9FC] px-4 text-[13px] font-semibold text-slate-700"><option value="America/Sao_Paulo">Brasília / São Paulo</option><option value="America/Manaus">Manaus</option><option value="America/Belem">Belém</option></select></label></div>
      <div className="mt-6 flex justify-end"><button disabled={pending} className="app-button-primary" type="submit">{pending?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>} {pending?"Salvando...":"Salvar perfil"}</button></div>
    </form>
    <aside className="rounded-[20px] border border-[#EAECF0] bg-white p-6 shadow-[var(--shadow-card)]"><span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#EEF2FF] text-[#415BA5]"><KeyRound size={20}/></span><h2 className="mt-5 text-base font-extrabold text-slate-900">Segurança da conta</h2><p className="mt-2 text-xs font-medium leading-6 text-slate-500">E-mail autenticado: <strong className="text-slate-700">{profile.email}</strong>. Alterações de senha utilizam um link seguro.</p><Link className="app-button-secondary mt-5 w-full border border-[#D9DEEA]" href="/redefinir-senha">Alterar minha senha</Link></aside>
  </div>;
}
