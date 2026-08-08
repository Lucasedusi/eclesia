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
import { usePathname, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type NavigationFeedbackContextValue = {
  pending: boolean;
  startNavigation: () => void;
  finishNavigation: () => void;
};

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null);
const NAVIGATION_TIMEOUT_MS = 20_000;

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;

  const current = new URL(window.location.href);
  const sameDocument =
    destination.pathname === current.pathname &&
    destination.search === current.search;

  return !sameDocument;
}

function NavigationCompletionListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useContext(NavigationFeedbackContext);
  const finishNavigation = feedback?.finishNavigation;
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    finishNavigation?.();
  }, [finishNavigation, routeKey]);

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
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !isInternalNavigation(anchor)) return;

      startNavigation();
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.dataset.navigationForm === "true") {
        startNavigation();
      }
    }

    function handlePopState() {
      startNavigation();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", handlePopState);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [startNavigation]);

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
