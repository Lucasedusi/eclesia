"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ModalPortalContext = createContext<HTMLElement | null>(null);

export function ModalPortalProvider({ children, id = "modal-root" }: { children: React.ReactNode; id?: string }) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const registerPortalRoot = useCallback((node: HTMLDivElement | null) => {
    if (node) setPortalRoot(node);
  }, []);

  return (
    <>
      <ModalPortalContext.Provider value={portalRoot}>
        {children}
      </ModalPortalContext.Provider>
      <div id={id} ref={registerPortalRoot} />
    </>
  );
}

export function useModalPortalRoot() {
  return useContext(ModalPortalContext);
}
