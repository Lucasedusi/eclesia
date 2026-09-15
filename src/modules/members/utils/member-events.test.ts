import { describe, expect, it } from "vitest";
import { toMemberEventItem } from "./member-events";

describe("member event history", () => {
  it("expõe somente nome, data e local do evento", () => {
    expect(toMemberEventItem({
      id: "event-1",
      name: "Conferência de Jovens",
      starts_at: "2026-10-12T22:00:00Z",
      location_name: "Templo Central",
      city: "Goiânia",
      state: "GO",
    })).toEqual({
      id: "event-1",
      name: "Conferência de Jovens",
      startsAt: "2026-10-12T22:00:00Z",
      location: "Templo Central · Goiânia / GO",
    });
  });

  it("usa uma indicação neutra quando o local ainda não foi informado", () => {
    expect(toMemberEventItem({
      id: "event-2",
      name: "Culto especial",
      starts_at: "2026-11-01T21:00:00Z",
      location_name: null,
      city: null,
      state: null,
    }).location).toBe("Local não informado");
  });
});
