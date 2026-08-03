"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toast, ToastViewport } from "@/components/ui/toast";

type ToastVariant = "success" | "danger" | "warning" | "neutral";
type ToastState = { title: string; variant: ToastVariant; filled?: boolean };

export function DesignSystemToastTester() {
  const [activeToast, setActiveToast] = useState<ToastState | null>({
    title: "Cadastro salvo com sucesso",
    variant: "success",
  });

  const options: Array<{ label: string; toast: ToastState }> = [
    { label: "Toast sucesso", toast: { title: "Cadastro salvo com sucesso", variant: "success" } },
    { label: "Sucesso filled", toast: { title: "Membro cadastrado com sucesso", variant: "success", filled: true } },
    { label: "Toast erro", toast: { title: "Não foi possível salvar agora", variant: "danger" } },
    { label: "Erro filled", toast: { title: "Já existe um membro com este CPF", variant: "danger", filled: true } },
    { label: "Toast alerta", toast: { title: "Revise os campos obrigatórios", variant: "warning" } },
    { label: "Toast neutro", toast: { title: "Salvando cadastro do membro", variant: "neutral", filled: true } },
  ];

  return <>
    {activeToast ? <ToastViewport><Toast title={activeToast.title} description="Esta é a mensagem complementar da notificação." variant={activeToast.variant} filled={activeToast.filled} onClose={() => setActiveToast(null)} /></ToastViewport> : null}
    <div className="rounded-[6px] border border-[#EAECF0] bg-[#F9FAFB] p-4">
      <div className="mb-4"><h3 className="text-[15px] font-bold text-[var(--text-title)]">Teste temporário dos Toasts</h3><p className="mt-1 text-[13px] font-medium leading-5 text-[var(--text-body)]">Clique em uma opção para manter o toast fixo na tela enquanto ajusta o estilo do componente.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option)=><Button key={option.label} variant="outline" size="sm" onClick={()=>setActiveToast(option.toast)}>{option.label}</Button>)}
        <Button variant="secondary" size="sm" onClick={()=>setActiveToast(null)}>Ocultar toast</Button>
      </div>
    </div>
  </>;
}
