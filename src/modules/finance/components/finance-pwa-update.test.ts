import { describe, expect, it } from "vitest";
import { planFinancePwaUpdate } from "./finance-pwa-update";

describe("finance PWA update decision", () => {
  it("blocks activation and reload while a finance form is dirty", () => {
    expect(planFinancePwaUpdate({ waiting: true, alreadyActivated: false, dirty: true })).toBe("BLOCKED");
    expect(planFinancePwaUpdate({ waiting: false, alreadyActivated: true, dirty: true })).toBe("BLOCKED");
  });

  it("activates a waiting worker only on a clean explicit request", () => {
    expect(planFinancePwaUpdate({ waiting: true, alreadyActivated: false, dirty: false })).toBe("ACTIVATE");
    expect(planFinancePwaUpdate({ waiting: false, alreadyActivated: true, dirty: false })).toBe("RELOAD");
    expect(planFinancePwaUpdate({ waiting: false, alreadyActivated: false, dirty: false })).toBe("NONE");
  });
});
