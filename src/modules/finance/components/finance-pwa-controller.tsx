"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { planFinancePwaUpdate } from "./finance-pwa-update";

function subscribeConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function FinancePwaController({
  hasUnsavedChanges,
}: {
  hasUnsavedChanges: () => boolean;
}) {
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine, () => true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [readyToReload, setReadyToReload] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const reloadOnControl = useRef(false);
  const hadController = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let mounted = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installing: ServiceWorker | null = null;
    hadController.current = Boolean(navigator.serviceWorker.controller);
    const showWaiting = () => {
      if (mounted && registration?.waiting) setWaiting(registration.waiting);
    };
    const onStateChange = () => {
      if (installing?.state === "installed" && navigator.serviceWorker.controller) showWaiting();
    };
    const onUpdateFound = () => {
      installing?.removeEventListener("statechange", onStateChange);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", onStateChange);
    };
    const onControllerChange = () => {
      if (reloadOnControl.current) {
        reloadOnControl.current = false;
        if (hasUnsavedChanges()) {
          setWaiting(null);
          setReadyToReload(true);
          setUpdateMessage("Salve ou descarte o preenchimento antes de atualizar o aplicativo.");
        } else {
          window.location.reload();
        }
      } else if (hadController.current) {
        setWaiting(null);
        setReadyToReload(true);
        setUpdateMessage("Uma atualização está pronta para recarregar.");
      }
      hadController.current = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.register("/financeiro-sw.js", { scope: "/" }).then((activeRegistration) => {
      if (!mounted) return;
      registration = activeRegistration;
      showWaiting();
      registration.addEventListener("updatefound", onUpdateFound);
      void registration.update().catch(() => {});
    }).catch(() => {});
    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      installing?.removeEventListener("statechange", onStateChange);
    };
  }, [hasUnsavedChanges]);

  function update() {
    const decision = planFinancePwaUpdate({
      waiting: Boolean(waiting),
      alreadyActivated: readyToReload,
      dirty: hasUnsavedChanges(),
    });
    if (decision === "BLOCKED") {
      setUpdateMessage("Salve ou descarte o preenchimento antes de atualizar o aplicativo.");
      return;
    }
    if (decision === "RELOAD") {
      window.location.reload();
      return;
    }
    if (decision !== "ACTIVATE" || !waiting) return;
    setUpdateMessage("Atualizando o aplicativo…");
    reloadOnControl.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <div className="finance-pwa-status no-print">
      {!online && (
        <div className="finance-pwa-offline" role="alert">
          <WifiOff size={18} aria-hidden="true" />
          <span>Sem conexão. Mantenha esta tela aberta; operações financeiras exigem internet.</span>
        </div>
      )}
      {(waiting || readyToReload) && (
        <div className="finance-pwa-update" role="status">
          <span>Uma atualização está pronta.</span>
          <button type="button" onClick={update}>
            <RefreshCw size={16} aria-hidden="true" /> Atualizar agora
          </button>
          {updateMessage && <span>{updateMessage}</span>}
        </div>
      )}
    </div>
  );
}
