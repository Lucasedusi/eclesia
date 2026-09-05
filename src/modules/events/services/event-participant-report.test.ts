import { describe, expect, it } from "vitest";
import type {
  EventParticipantReportConfig,
  EventParticipantReportSource,
} from "../types/event.types";
import { organizeEventParticipants } from "./event-participant-report";

function config(organization: EventParticipantReportConfig["organization"]): EventParticipantReportConfig {
  return {
    filters: { regionId: "", congregationId: "", roleId: "", gender: "", registrationStatus: "", paymentMethod: "", paymentStatus: "", itemId: "", registeredFrom: "", registeredTo: "" },
    columns: { index: true, registrationNumber: false, role: true, gender: true, phone: false, registrationStatus: false, paymentMethod: false, paymentStatus: false, registeredAt: true, items: false },
    organization,
    showAppliedFilters: true,
    showIssuedAt: true,
  };
}

function participant(overrides: Partial<EventParticipantReportSource>): EventParticipantReportSource {
  return {
    id: "registration",
    registrationNumber: null,
    participantName: "Participante",
    participantGender: null,
    participantPhone: null,
    roleName: null,
    congregationId: null,
    congregationName: null,
    congregationDisplayOrder: Number.MAX_SAFE_INTEGER,
    regionId: null,
    regionName: null,
    regionDisplayOrder: Number.MAX_SAFE_INTEGER,
    registrationStatus: "CONFIRMED",
    paymentMethod: null,
    paymentStatus: "NOT_REQUIRED",
    registeredAt: "2026-08-22T12:00:00Z",
    itemNames: [],
    ...overrides,
  };
}

describe("organizeEventParticipants", () => {
  const rows = [
    participant({ id: "3", participantName: "Bruno", regionId: "north", regionName: "Regional Norte", regionDisplayOrder: 2, congregationId: "zion", congregationName: "Zion", congregationDisplayOrder: 1 }),
    participant({ id: "2", participantName: "Carlos", regionId: "central", regionName: "Regional Central", regionDisplayOrder: 1, congregationId: "alvorada", congregationName: "Alvorada", congregationDisplayOrder: 1 }),
    participant({ id: "1", participantName: "Ana", regionId: "central", regionName: "Regional Central", regionDisplayOrder: 1, congregationId: "alvorada", congregationName: "Alvorada", congregationDisplayOrder: 1 }),
  ];

  it("ordena por regional em uma sequência contínua e numera o resultado", () => {
    const result = organizeEventParticipants(rows, config("BY_REGION"));
    expect(result.map((row) => [row.index, row.participantName])).toEqual([[1, "Ana"], [2, "Carlos"], [3, "Bruno"]]);
    expect(result[0].congregationAndRegion).toBe("Alvorada - Regional Central");
  });

  it("ordena alfabeticamente sem criar agrupamentos", () => {
    const result = organizeEventParticipants(rows, config("ALPHABETICAL"));
    expect(result.map((row) => row.participantName)).toEqual(["Ana", "Bruno", "Carlos"]);
  });
});
