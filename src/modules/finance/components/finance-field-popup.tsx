"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import styles from "./finance-pickers.module.css";

/** Keep the panel inside its form/dialog for focus management, above scroll clipping. */
export function FinanceFieldPopup({
  anchor,
  children,
  onDismiss,
  alignTo,
  width,
}: {
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  onDismiss: () => void;
  alignTo?: RefObject<HTMLElement | null>;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useLayoutEffect(() => {
    const el = panel.current;
    const field = anchor.current;
    if (!el || !field) return;
    const bounds = alignTo?.current ?? field;
    el.showPopover?.();
    function position() {
      if (!el || !field) return;
      const rect = bounds.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const right =
        left + (viewport?.width ?? document.documentElement.clientWidth);
      const panelWidth = Math.min(width ?? rect.width, right - left - 16);
      el.style.width = panelWidth + "px";
      el.style.left =
        Math.max(left + 8, Math.min(rect.left, right - panelWidth - 8)) + "px";
      const below = bottom - rect.bottom - 12;
      const above = rect.top - top - 12;
      const upward = below < el.scrollHeight && above > below;
      const space = Math.max(72, upward ? above : below);
      el.style.maxHeight = space + "px";
      el.style.top =
        Math.max(
          top + 4,
          upward ? rect.top - el.offsetHeight - 4 : rect.bottom + 4,
        ) + "px";
    }
    position();
    // Keep Escape inside this panel while a lazy calendar is still loading.
    el.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(el);
    observer.observe(bounds);
    function outside(event: Event) {
      const target = event.target;
      if (
        target instanceof Node &&
        !el!.contains(target) &&
        !field!.contains(target)
      )
        dismiss.current();
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [anchor, alignTo, width]);
  return (
    <div
      ref={panel}
      tabIndex={-1}
      popover="manual"
      className={styles.popup}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
          anchor.current?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
