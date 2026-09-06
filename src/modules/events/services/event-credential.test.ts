import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canIssueEventCredential } from "./event-credential.service";

describe("canIssueEventCredential", () => {
  it("permite comprovante confirmado ou já credenciado", () => {
    expect(canIssueEventCredential("CONFIRMED")).toBe(true);
    expect(canIssueEventCredential("CHECKED_IN")).toBe(true);
  });

  it("não emite credencial para estados pendentes ou encerrados", () => {
    expect(canIssueEventCredential("PENDING")).toBe(false);
    expect(canIssueEventCredential("CANCELLED")).toBe(false);
    expect(canIssueEventCredential("NO_SHOW")).toBe(false);
  });
});
