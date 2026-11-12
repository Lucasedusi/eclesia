function disablePageScroll() {
  const body = document.body;
  const root = document.documentElement;
  const previousBodyOverflow = body.style.overflow;
  const previousBodyPaddingRight = body.style.paddingRight;
  const previousRootOverflow = root.style.overflow;
  const scrollbarWidth = window.innerWidth - root.clientWidth;

  root.style.overflow = "hidden";
  body.style.overflow = "hidden";

  if (scrollbarWidth > 0) {
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }

  return () => {
    root.style.overflow = previousRootOverflow;
    body.style.overflow = previousBodyOverflow;
    body.style.paddingRight = previousBodyPaddingRight;
  };
}

let openModals = 0;
let restoreScroll: (() => void) | undefined;

export function lockModalScroll() {
  if (openModals === 0) restoreScroll = disablePageScroll();
  openModals += 1;

  return () => {
    openModals -= 1;
    if (openModals === 0) {
      restoreScroll?.();
      restoreScroll = undefined;
    }
  };
}
