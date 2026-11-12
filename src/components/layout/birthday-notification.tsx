"use client";

import Link from "next/link";
import { Bell, Cake, ListX, MessageCircle, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as S from "./app-header.styles";

const localDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

type BirthdayNotice = {
  day: string;
  count: number;
  items?: { id: string; name: string; congregation: string | null; whatsapp: string | null }[];
};

export function BirthdayNotification({ accessId }: { accessId: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [notice, setNotice] = useState<BirthdayNotice | "error" | "denied" | null>(null);
  const [clearedDay, setClearedDay] = useState<string | null>(null);
  const storageKey = `eklesias:birthday-notice:${accessId}`;

  useEffect(() => {
    const details = menu.current;
    let request: AbortController | undefined;
    let day = localDay.format(new Date());

    function syncDismissal() {
      try { setClearedDay(localStorage.getItem(storageKey)); } catch { /* Keep the in-memory choice. */ }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) syncDismissal();
    }
    async function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      day = localDay.format(new Date());
      try {
        const url = "/api/members/birthdays/today" + (details?.open ? "?view=list" : "");
        const response = await fetch(url, {
          cache: "no-store", signal: controller.signal, headers: { "X-Eklesias-Access": accessId },
        });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setNotice("denied");
          return;
        }
        if (!response.ok) throw new Error();
        const result: BirthdayNotice = await response.json();
        if (!controller.signal.aborted) setNotice(result);
      } catch {
        if (!controller.signal.aborted) setNotice("error");
      }
    }

    function onToggle() {
      if (details?.open) void refresh();
      else {
        setNotice(current => current && typeof current === "object" ? { day: current.day, count: current.count } : current);
        void refresh();
      }
    }
    function onVisible() { if (!document.hidden) void refresh(); }
    syncDismissal();
    void refresh();
    details?.addEventListener("toggle", onToggle);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (!document.hidden && day !== localDay.format(new Date())) void refresh();
    }, 30_000);
    return () => {
      request?.abort();
      window.clearInterval(timer);
      details?.removeEventListener("toggle", onToggle);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      if (details) details.open = false;
    };
  }, [accessId, storageKey]);

  if (notice === "denied") return null;
  const data = notice && typeof notice === "object" ? notice : null;
  const cleared = data !== null && data.day === clearedDay;
  const hasBirthdays = Boolean(data && data.count > 0 && !cleared);
  const items = cleared ? undefined : data?.items;
  const bellLabel = data && hasBirthdays
    ? `Notificações: ${data.count === 1 ? "1 aniversariante" : data.count + " aniversariantes"} hoje`
    : "Notificações";

  function clearToday() {
    if (!data) return;
    setClearedDay(data.day);
    try { localStorage.setItem(storageKey, data.day); } catch { /* Still dismissed for this visit. */ }
  }

  let message = "Consultando aniversariantes…";
  if (notice === "error") message = "Não foi possível consultar os aniversariantes agora.";
  if (data?.count === 0) message = "Nenhum aniversariante hoje.";
  if (cleared) message = "Notificações de hoje limpas.";

  return (
    <S.UserMenu ref={menu} name="header-menu">
      <S.BellTrigger aria-label={bellLabel}>
        <Bell size={18} strokeWidth={1.7} aria-hidden />
        {hasBirthdays && <S.NotificationDot />}
      </S.BellTrigger>
      <S.NotificationPanel aria-label="Aniversariantes">
        <div className="notice-heading">
          <h2>Aniversariantes</h2>
          <button type="button" onClick={clearToday} disabled={!hasBirthdays}
            aria-label="Limpar notificações de hoje" title="Limpar notificações de hoje">
            <ListX size={19} aria-hidden />
          </button>
        </div>
        <div className="notice-body">
          {items?.length ? <>
            <ul>{items.map(person => <li key={person.id}>
              <span className="notice-cake"><Cake size={19} aria-hidden /></span>
              <div className="notice-person">
                <strong>{person.name}</strong>
                {person.congregation && <small>{person.congregation}</small>}
              </div>
              {person.whatsapp && <a className="notice-whatsapp" href={person.whatsapp} target="_blank" rel="noopener noreferrer"
                title={`Abrir WhatsApp de ${person.name}`} aria-label={`Abrir WhatsApp de ${person.name}`}>
                <MessageCircle size={23} strokeWidth={1.8} aria-hidden />
                <Phone size={11} fill="currentColor" strokeWidth={1} aria-hidden />
              </a>}
            </li>)}</ul>
            {data && data.count > items.length && <p>Exibindo {items.length} de {data.count} aniversariantes.</p>}
          </> : <p role="status">{message}</p>}
        </div>
        <Link className="notice-footer" href="/membros/aniversariantes" onNavigate={() => { if (menu.current) menu.current.open = false; }}>
          Ver Lista de Aniversariantes
        </Link>
      </S.NotificationPanel>
    </S.UserMenu>
  );
}
