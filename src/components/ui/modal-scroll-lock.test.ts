import { afterEach, expect, it, vi } from "vitest";
import { lockModalScroll } from "./modal-scroll-lock";

afterEach(() => vi.unstubAllGlobals());

it.each(["ficha", "editor"])(
  "restaura os estilos somente ao fechar o último modal quando %s fecha primeiro",
  (firstToClose) => {
    const root = {
      style: { overflow: "auto" },
      get clientWidth() {
        return this.style.overflow === "hidden" ? 1000 : 980;
      },
    };
    const body = { style: { overflow: "visible", paddingRight: "6px" } };
    vi.stubGlobal("document", { documentElement: root, body });
    vi.stubGlobal("window", {
      innerWidth: 1000,
      getComputedStyle: () => body.style,
    });

    const closeDetails = lockModalScroll();
    const closeEditor = lockModalScroll();
    expect(body.style.paddingRight).toBe("26px");

    const [closeFirst, closeLast] =
      firstToClose === "ficha" ? [closeDetails, closeEditor] : [closeEditor, closeDetails];
    closeFirst();
    expect(root.style.overflow).toBe("hidden");
    expect(body.style).toEqual({ overflow: "hidden", paddingRight: "26px" });

    closeLast();
    expect(root.style.overflow).toBe("auto");
    expect(body.style).toEqual({ overflow: "visible", paddingRight: "6px" });
  },
);
