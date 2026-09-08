"use client";

import { type ReactNode, useState } from "react";
import { CalendarDays, ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import { Toast, ToastViewport } from "@/components/ui/toast";
import type { PublicStatusTone } from "../utils/public-registration-flow";
import * as S from "./events.styles";

export type PublicFlowNotice = {
  message: string;
  title?: string;
  danger?: boolean;
  tone?: PublicStatusTone;
};

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
  notice: PublicFlowNotice | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  const variant = notice.tone ?? (notice.danger ? "danger" : "success");
  const defaultTitle = variant === "danger"
    ? "Não foi possível concluir"
    : variant === "warning"
      ? "Atenção"
      : variant === "neutral"
        ? "Informação"
        : "Tudo certo";

  return <ToastViewport className="public-flow-toast-viewport">
    <Toast
      className="public-flow-toast"
      title={notice.title ?? defaultTitle}
      description={notice.message}
      variant={variant}
      duration={variant === "danger" ? 6000 : variant === "warning" ? 4500 : 3200}
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
