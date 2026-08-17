import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("web vitals telemetry", () => {
  it("aceita somente o conjunto mínimo e não persiste dados pessoais", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(new Request("http://localhost/api/telemetry/web-vitals", {
      method: "POST",
      body: JSON.stringify({
        id: "v4-123",
        name: "LCP",
        value: 842.4,
        delta: 12.2,
        rating: "good",
        navigationType: "navigate",
        route: "/membros",
        entryKind: "first-entry",
      }),
    }));

    expect(response.status).toBe(204);
    expect(info).toHaveBeenCalledWith("[web-vitals]", expect.objectContaining({
      name: "LCP",
      route: "/membros",
    }));
  });

  it("rejeita métricas fora da lista permitida", async () => {
    const response = await POST(new Request("http://localhost/api/telemetry/web-vitals", {
      method: "POST",
      body: JSON.stringify({ name: "EMAIL", value: 1, rating: "good", route: "/" }),
    }));

    expect(response.status).toBe(400);
  });
});
