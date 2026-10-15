"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeDisplayMode(callback: () => void) {
  const standalone = window.matchMedia("(display-mode: standalone)");
  standalone.addEventListener("change", callback);
  return () => standalone.removeEventListener("change", callback);
}

function readStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function FinancePwaInstall() {
  const standaloneMode = useSyncExternalStore(subscribeDisplayMode, readStandalone, () => true);
  const [installed, setInstalled] = useState(false);
  const standalone = standaloneMode || installed;
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);

  useEffect(() => {
    const installed = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(false);
    };
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("appinstalled", installed);
    window.addEventListener("beforeinstallprompt", offerInstall);
    return () => {
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("beforeinstallprompt", offerInstall);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (standalone) return null;

  return (
    <div className="finance-pwa-install">
      <button type="button" onClick={() => void install()}>
        <Download size={16} aria-hidden="true" /> Instalar aplicativo
      </button>
      {installHelp && (
        <div className="finance-pwa-install-help" role="status">
          <span>
            {isIosDevice()
              ? "No iPhone, abra no Safari e escolha Compartilhar → Adicionar à Tela de Início."
              : "No navegador, abra o menu e escolha Instalar aplicativo ou Adicionar à tela inicial."}
          </span>
          <button type="button" aria-label="Fechar orientação de instalação" onClick={() => setInstallHelp(false)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
