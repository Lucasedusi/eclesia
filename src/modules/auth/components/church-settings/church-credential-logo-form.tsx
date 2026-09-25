"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ImageUp } from "lucide-react";
import { uploadChurchCredentialLogoAction } from "../../actions/church-logo.actions";
import { INITIAL_ACTION_STATE } from "../../types/auth.types";

export function ChurchCredentialLogoForm({ logoDataUri, canUpdate }: { logoDataUri: string | null; canUpdate: boolean }) {
  const [state, action, pending] = useActionState(uploadChurchCredentialLogoAction, INITIAL_ACTION_STATE);
  return <section className="mt-6 rounded-[20px] border border-[#EAECF0] bg-white p-6 shadow-[var(--shadow-card)]">
    <h2 className="m-0 text-base font-bold text-slate-900">Logo da carteirinha</h2>
    <p className="mt-1 text-xs text-slate-500">A mesma imagem aparece na frente e, de forma discreta, como marca d&apos;água no verso.</p>
    <div className="mt-5 flex flex-wrap items-center gap-5">
      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#D4A72C] bg-white p-2">
        {logoDataUri ? <Image src={logoDataUri} alt="Logo atual da carteirinha" width={96} height={96} unoptimized className="h-full w-full object-contain" /> : <span className="text-center text-xs font-semibold text-slate-500">Sem logo</span>}
      </div>
      {canUpdate ? <form action={action} className="min-w-[240px] flex-1">
        <label className="block text-xs font-semibold text-slate-600" htmlFor="church-credential-logo">Selecionar logo oficial</label>
        <input id="church-credential-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required disabled={pending} className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F2F4F7] file:px-4 file:py-2 file:font-semibold file:text-[#354B8E]" />
        <p className="mt-2 text-xs text-slate-500">PNG transparente recomendado. JPG ou WebP também são aceitos, até 2 MB.</p>
        {state.status !== "idle" ? <p role="status" className={`mt-3 text-xs font-semibold ${state.status === "success" ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p> : null}
        <button type="submit" disabled={pending} className="app-button-primary mt-4"><ImageUp size={16}/>{pending ? "Enviando..." : "Salvar logo"}</button>
      </form> : <p className="text-xs text-slate-500">Seu acesso permite consultar, mas não alterar a logo.</p>}
    </div>
  </section>;
}
