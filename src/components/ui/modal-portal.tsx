"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ModalPortalContext = createContext<HTMLElement | null>(null);

export function ModalPortalProvider({ children }: { children: React.ReactNode }) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const registerPortalRoot = useCallback((node: HTMLDivElement | null) => {
    if (node) setPortalRoot(node);
  }, []);

  return (
    <>
      <ModalPortalContext.Provider value={portalRoot}>
        {children}
      </ModalPortalContext.Provider>
      <div id="modal-root" ref={registerPortalRoot} />
    </>
  );
}

export function useModalPortalRoot() {
  return useContext(ModalPortalContext);
}
