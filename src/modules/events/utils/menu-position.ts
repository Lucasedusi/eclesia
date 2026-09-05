type AnchorRect = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

export function positionAnchoredMenu(anchor: AnchorRect, menu: Size, viewport: Size, gap = 4, padding = 8) {
  const left = Math.min(
    Math.max(padding, anchor.right - menu.width),
    Math.max(padding, viewport.width - menu.width - padding),
  );
  const fitsBelow = anchor.bottom + gap + menu.height <= viewport.height - padding;
  const top = fitsBelow ? anchor.bottom + gap : Math.max(padding, anchor.top - gap - menu.height);
  return { left, top };
}
