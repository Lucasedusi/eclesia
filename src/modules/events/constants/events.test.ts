import { describe, expect, it, vi } from "vitest";
import { CHECKIN_METHODS, CHECKIN_STATUSES, eventBadgeTone, eventLabel } from "./events";

describe("eventLabel", () => {
  it("traduz os enums técnicos do check-in", () => {
    expect(eventLabel(CHECKIN_METHODS, "SEARCH")).toBe("Busca manual");
    expect(eventLabel(CHECKIN_STATUSES, "CHECKED_IN")).toBe("Check-in realizado");
  });

  it("humaniza um valor novo sem expor o formato do banco", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(eventLabel(CHECKIN_METHODS, "NEW_METHOD")).toBe("New Method");
    expect(warning).toHaveBeenCalledWith("[events] enum value without a mapped label", { value: "NEW_METHOD" });
    warning.mockRestore();
  });

  it("aplica o padrão visual dos status financeiros", () => {
    expect(eventBadgeTone("PARTIAL")).toBe("warning");
    expect(eventBadgeTone("PENDING")).toBe("warning");
    expect(eventBadgeTone("FAILED")).toBe("danger");
    expect(eventBadgeTone("NO_SHOW")).toBe("danger");
    expect(eventBadgeTone("CONFIRMED")).toBe("success");
  });
});
