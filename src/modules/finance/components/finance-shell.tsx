"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  useTransition,
  useSyncExternalStore,
} from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ArrowLeft,
  ChartNoAxesCombined,
  Wallet,
  ReceiptText,
  HandCoins,
  SlidersHorizontal,
  Landmark,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { FinanceUnit } from "../types/finance.types";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceThemeProvider } from "./finance-theme-provider";
import { FinanceContextBar } from "./finance-context-bar";
import { Workspace } from "./finance-shell.styles";
const sidebarPreference = "eclesias:finance:sidebar-collapsed";
function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("finance-sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("finance-sidebar-change", callback);
  };
}
function readSidebar() {
  try {
    return localStorage.getItem(sidebarPreference) === "true";
  } catch {
    return false;
  }
}
type Guard = {
  dirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void | boolean;
};
type Navigation = {
  navigate: (url: string) => void;
  refresh: () => void;
  isPending: boolean;
  register: (guard: Guard) => () => void;
};
const NavigationContext = createContext<Navigation | null>(null);
export function useFinanceNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("Finance workspace missing");
  return value;
}
export function useFinanceDirtyGuard(
  dirty: boolean,
  save: () => Promise<boolean>,
  discard: () => void | boolean,
) {
  const { register } = useFinanceNavigation();
  useEffect(
    () => register({ dirty, save, discard }),
    [dirty, save, discard, register],
  );
}
export type FinanceShellDTO = {
  name: string;
  churchName: string;
  units: FinanceUnit[];
  defaultUnitId: string;
  defaultMonth: string;
};
export function FinanceShell({
  context,
  children,
}: {
  context: FinanceShellDTO;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    readSidebar,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  function toggleSidebar() {
    try {
      localStorage.setItem(sidebarPreference, String(!collapsed));
    } catch {
      return;
    }
    window.dispatchEvent(new Event("finance-sidebar-change"));
  }
  const [isPending, startTransition] = useTransition();
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );
  const push = useCallback(
    (url: string) => startTransition(() => router.push(url, { scroll: false })),
    [router],
  );
  const unit =
    context.units.find((u) => u.id === search.get("unidade")) ??
    context.units.find((u) => u.id === context.defaultUnitId)!;
  const month = search.get("mes") ?? context.defaultMonth;
  const guards = useRef(new Set<Guard>()),
    [pending, setPending] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const register = useCallback((g: Guard) => {
    guards.current.add(g);
    return () => {
      guards.current.delete(g);
    };
  }, []);
  const navigate = useCallback(
    (url: string) => {
      if ([...guards.current].some((g) => g.dirty)) setPending(url);
      else push(url);
    },
    [push, setPending],
  );
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if ([...guards.current].some((g) => g.dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const links = [
    {
      label: "Visão geral",
      path: "/financeiro",
      icon: ChartNoAxesCombined,
      show: true,
    },
    {
      label: "Lançamentos",
      path: "/financeiro/lancamentos",
      icon: ReceiptText,
      show: true,
    },
    {
      label: "Atendimento",
      path: "/financeiro/atendimento",
      icon: HandCoins,
      show: unit.capabilities?.create,
    },
    {
      label: "Caixas e contas",
      path: "/financeiro/caixas",
      icon: Wallet,
      show: true,
    },
    {
      label: "Demonstrativos",
      path: "/financeiro/demonstrativos",
      icon: Landmark,
      show: true,
    },
    {
      label: "Configurações",
      path: "/financeiro/configuracoes",
      icon: SlidersHorizontal,
      show: unit.capabilities?.manageSettings,
    },
  ];
  return (
    <FinanceThemeProvider>
      <NavigationContext.Provider
        value={{ navigate, register, refresh, isPending }}
      >
        <Workspace
          className="finance"
          data-app-shell
          data-collapsed={collapsed}
          data-mobile-open={mobileOpen}
        >
          <aside className="finance-sidebar" id="finance-sidebar">
            <div className="finance-logo">
              <span>
                <Leaf size={21} />
              </span>
              <b className="finance-nav-label">eclesias</b>{" "}
              <small
                className="finance-nav-label"
                style={{ fontSize: 9, color: "#6D7F76", letterSpacing: 1 }}
              >
                FIN
              </small>
            </div>
            <p
              className="eyebrow"
              style={{ padding: "0 15px", marginBottom: 18 }}
            >
              Gestão financeira
            </p>
            <nav aria-label="Navegação financeira">
              {links
                .filter((l) => l.show)
                .map((l) => (
                  <Link
                    key={l.path}
                    href={financeLocation(l.path, unit.id, month)}
                    title={l.label}
                    aria-label={l.label}
                    aria-current={path === l.path ? "page" : undefined}
                    onNavigate={(e) => {
                      e.preventDefault();
                      setMobileOpen(false);
                      navigate(financeLocation(l.path, unit.id, month));
                    }}
                  >
                    <l.icon size={19} />
                    <span className="finance-nav-label">{l.label}</span>
                  </Link>
                ))}
            </nav>
            <div className="finance-bottom">
              <div className="notice" style={{ marginBottom: 24 }}>
                <Leaf size={20} />
                <p>
                  Cuidar dos recursos.
                  <br />
                  <strong>Servir com transparência.</strong>
                </p>
              </div>
              <Link
                title="Voltar ao sistema"
                aria-label="Voltar ao sistema"
                href="/"
                onNavigate={(e) => {
                  e.preventDefault();
                  navigate("/");
                }}
              >
                <ArrowLeft size={16} />
                <span className="finance-nav-label">Voltar ao sistema</span>
              </Link>
            </div>
          </aside>
          <header className="finance-topbar">
            <button
              type="button"
              className="finance-menu-toggle finance-desktop-toggle"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!collapsed}
              aria-controls="finance-sidebar"
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>
            <button
              type="button"
              className="finance-menu-toggle finance-mobile-toggle"
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileOpen}
              aria-controls="finance-sidebar"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <FinanceContextBar
              units={context.units}
              selectedUnitId={unit.id}
              month={month}
              onChange={(u, m) => navigate(financeLocation(path, u, m))}
            />
            <div className="row">
              <div className="identity" style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12 }}>{context.name}</div>
                <div className="muted" style={{ fontSize: 10 }}>
                  {context.churchName}
                </div>
              </div>
              <div className="finance-user" aria-hidden="true">
                {context.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </div>
            </div>
          </header>
          {isPending && (
            <div className="finance-progress no-print" role="status">
              <span className="finance-spinner" /> Atualizando financeiro…
            </div>
          )}
          <main className="finance-main" key={unit.id} aria-busy={isPending}>
            {children}
          </main>
        </Workspace>
        <Modal
          open={pending !== null}
          title="Há alterações não salvas"
          description="Escolha o que fazer antes de mudar de tela ou congregação."
          busy={saving}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setPending(null)}>
                Continuar editando
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  for (const g of [...guards.current])
                    if (g.dirty && g.discard() === false) return;
                  const target = pending;
                  setPending(null);
                  if (target) push(target);
                }}
              >
                Descartar
              </Button>
              <Button
                loading={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    for (const g of [...guards.current])
                      if (g.dirty && !(await g.save())) return;
                    const target = pending;
                    setPending(null);
                    if (target) push(target);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Salvar e continuar
              </Button>
            </>
          }
        />
      </NavigationContext.Provider>
    </FinanceThemeProvider>
  );
}
