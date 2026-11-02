"use client";
import { useId, useState } from "react";
import { Download, ExternalLink, FileCheck2, Info, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { DigitalReceiptLink } from "../types/finance-digital-receipt.types";
import { buildReceiptWhatsAppUrl } from "../utils/finance-digital-receipt";
import { DigitalReceiptContent, DigitalReceiptFooter } from "./finance-digital-receipt.styles";

export function FinanceDigitalReceiptDialog({ link, number, attendance, onClose }: {
  link: DigitalReceiptLink; number: string; attendance: boolean; onClose: () => void;
}) {
  const formId = useId();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const expires = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(link.expiresAt));
  return <Modal title="Comprovante digital" description="Compartilhe o link ou guarde uma cópia em PDF." size="sm" onClose={onClose}
    footer={<DigitalReceiptFooter><Button variant="outline" onClick={onClose}>Voltar aos detalhes</Button><Button type="submit" form={formId}><MessageCircle size={16} aria-hidden="true" />Abrir WhatsApp</Button></DigitalReceiptFooter>}>
    <DigitalReceiptContent>
      <div className="digital-summary"><span className="digital-summary-icon"><FileCheck2 size={22} aria-hidden="true" /></span><div><strong>Pronto para compartilhar</strong><small>{number}</small>{attendance && <small>Reúne todas as contribuições deste atendimento.</small>}</div></div>
      <div className="digital-links"><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden="true" />Visualizar comprovante</a><a href={`${link.url}/pdf`} target="_blank" rel="noopener noreferrer"><Download size={15} aria-hidden="true" />Baixar PDF</a></div>
      <form id={formId} noValidate onSubmit={(event) => {
        event.preventDefault();
        try {
          const url = buildReceiptWhatsAppUrl(phone, link.url);
          setError("");
          window.open(url, "_blank", "noopener,noreferrer");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Informe um telefone válido com DDD.");
        }
      }}>
        <label className="digital-phone">Telefone do destinatário<input type="tel" inputMode="tel" autoComplete="off" placeholder="(62) 99999-9999" maxLength={30} value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={`${formId}-hint${error ? ` ${formId}-error` : ""}`} /></label>
        <p className="digital-hint" id={`${formId}-hint`}>Informe o DDD. Para outro país, comece com + e o código do país.</p>
        {error && <p className="digital-error" id={`${formId}-error`} role="alert">{error}</p>}
      </form>
      <div className="digital-note"><Info size={15} aria-hidden="true" /><span>Use o WhatsApp conectado à conta da igreja e confirme o envio na conversa. Quem tiver o link poderá acessar o comprovante até {expires}.</span></div>
    </DigitalReceiptContent>
  </Modal>;
}
