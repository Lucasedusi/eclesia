"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as S from "./app-header.styles";

const localDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

export function BirthdayNotification() {
  const menu = useRef<HTMLDetailsElement>(null);
  const [count, setCount] = useState<number | "error" | "denied" | null>(null);

  useEffect(() => {
    const details = menu.current;
    let request: AbortController | undefined;
    let day = localDay.format(new Date());

    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      day = localDay.format(new Date());
      try {
        const response = await fetch("/api/members/birthdays/today", { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setCount("denied");
          return;
        }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!Number.isSafeInteger(result.count) || result.count < 0) throw new Error();
        if (!controller.signal.aborted) setCount(result.count);
      } catch {
        if (!controller.signal.aborted) setCount("error");
      }
    }

    function onOpen() { if (details?.open) void refresh(); }
    function onVisible() { if (!document.hidden) void refresh(); }
    void refresh();
    details?.addEventListener("toggle", onOpen);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (!document.hidden && day !== localDay.format(new Date())) void refresh();
    }, 30_000);
    return () => {
      request?.abort();
      window.clearInterval(timer);
      details?.removeEventListener("toggle", onOpen);
      document.removeEventListener("visibilitychange", onVisible);
      if (details) details.open = false;
    };
  }, []);

  if (count === "denied") return null;
  const hasBirthdays = typeof count === "number" && count > 0;
  let message = "Consultando aniversariantes…";
  if (count === "error") message = "Não foi possível consultar os aniversariantes agora.";
  if (count === 0) message = "Nenhum aniversariante hoje.";
  if (hasBirthdays) message = count === 1 ? "Hoje há 1 aniversariante." : `Hoje há ${count} aniversariantes.`;

  return (
    <S.UserMenu ref={menu} name="header-menu">
      <S.BellTrigger aria-label={hasBirthdays ? `Notificações: ${message}` : "Notificações"}>
        <Bell size={18} strokeWidth={1.7} aria-hidden />
        {hasBirthdays && <S.NotificationDot />}
      </S.BellTrigger>
      <S.NotificationPanel>
        <p role="status">{message}</p>
        {hasBirthdays && <S.DropdownItem href="/membros/aniversariantes">Ver aniversariantes</S.DropdownItem>}
      </S.NotificationPanel>
    </S.UserMenu>
  );
}
