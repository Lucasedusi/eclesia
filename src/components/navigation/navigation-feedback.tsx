"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type NavigationFeedbackContextValue = {
  pending: boolean;
  startNavigation: () => void;
  finishNavigation: () => void;
};

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null);
const NAVIGATION_TIMEOUT_MS = 20_000;

function NavigationCompletionListener() {
  const pathname = usePathname();
  const feedback = useContext(NavigationFeedbackContext);
  const finishNavigation = feedback?.finishNavigation;

  useEffect(() => {
    finishNavigation?.();
  }, [finishNavigation, pathname]);

  return null;
}

export function NavigationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const finishNavigation = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setPending(false);
  }, []);

  const startNavigation = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setPending(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setPending(false);
    }, NAVIGATION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({ pending, startNavigation, finishNavigation }),
    [finishNavigation, pending, startNavigation],
  );

  return (
    <NavigationFeedbackContext.Provider value={value}>
      <div
        className="app-navigation-progress"
        data-visible={pending ? "true" : "false"}
        aria-hidden="true"
      >
        <span />
      </div>
      {children}
      <Suspense fallback={null}>
        <NavigationCompletionListener />
      </Suspense>
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  const value = useContext(NavigationFeedbackContext);
  if (!value) {
    throw new Error("useNavigationFeedback deve ser usado dentro de NavigationFeedbackProvider.");
  }
  return value;
}

export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={["app-link-pending", className].filter(Boolean).join(" ")}
      data-pending={pending ? "true" : "false"}
      aria-hidden="true"
    >
      <LoaderCircle />
    </span>
  );
}
