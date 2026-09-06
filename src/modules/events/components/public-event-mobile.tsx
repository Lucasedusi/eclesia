"use client";

import { type ReactNode, useState } from "react";
import { CalendarDays, ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import { Toast, ToastViewport } from "@/components/ui/toast";
import * as S from "./events.styles";

function eventDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export function PublicEventHeroMeta({ startsAt, location }: { startsAt: string; location: string }) {
  return <S.PublicHeroMeta aria-label="Informações do evento">
    <span><CalendarDays />{eventDate(startsAt)}</span>
    <span><MapPin />{location || "Local a definir"}</span>
  </S.PublicHeroMeta>;
}

export function PublicFlowToast({ notice, onClose }: {
  notice: { message: string; danger?: boolean } | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  return <ToastViewport className="public-flow-toast-viewport">
    <Toast
      className="public-flow-toast"
      title={notice.danger ? "Não foi possível concluir" : "Tudo certo"}
      description={notice.message}
      variant={notice.danger ? "danger" : "success"}
      duration={notice.danger ? 6000 : 3200}
      onClose={onClose}
    />
  </ToastViewport>;
}

export function PublicCollapsibleSummary({
  title,
  total,
  collapsible,
  defaultOpen,
  children,
}: {
  title: string;
  total: string;
  collapsible: boolean;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <S.PublicSummaryShell data-open={open} data-collapsible={collapsible}>
    <S.PublicSummaryToggle
      type="button"
      disabled={!collapsible}
      aria-expanded={open}
      onClick={() => collapsible && setOpen((current) => !current)}
    >
      <span><ShoppingCart /><span><small>{title}</small><strong>{total}</strong></span></span>
      {collapsible ? <ChevronDown /> : null}
    </S.PublicSummaryToggle>
    <S.PublicSummaryBody>{children}</S.PublicSummaryBody>
  </S.PublicSummaryShell>;
}
