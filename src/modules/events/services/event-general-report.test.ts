import { describe, expect, it } from "vitest";
import type { EventGeneralReportConfig } from "../types/event.types";
import { aggregateEventGeneralReport } from "./event-general-report";

function config(overrides: Partial<EventGeneralReportConfig> = {}): EventGeneralReportConfig {
  return {
    filters: {
      regionId: "",
      congregationId: "",
      roleId: "",
      gender: "",
      registrationStatus: "",
      paymentMethod: "",
      paymentStatus: "",
      itemId: "",
      registeredFrom: "",
      registeredTo: "",
      ...overrides.filters,
    },
    sections: {
      showSummary: true,
      showRegions: true,
      showCongregations: true,
      showRoles: false,
      showGenders: false,
      includeZeroCongregations: true,
      showAppliedFilters: true,
      showIssuedAt: true,
      ...overrides.sections,
    },
    columns: {
      regionalCoordinator: true,
      regionalQuota: true,
      regionalPercentage: true,
      congregationPastor: true,
      congregationQuota: true,
      congregationPercentage: true,
      ...overrides.columns,
    },
    organization: overrides.organization ?? "BY_REGION",
  };
}

const regions = [
  { id: "north", name: "Regional Norte", coordinatorName: "Marta", displayOrder: 2 },
  { id: "central", name: "Regional Central", coordinatorName: "João", displayOrder: 1 },
];

const congregations = [
  { id: "bela-vista", name: "Bela Vista", regionId: "central", pastorName: "Paulo", displayOrder: 2 },
  { id: "alvorada", name: "Alvorada", regionId: "central", pastorName: "Lucas", displayOrder: 1 },
  { id: "zion", name: "Zion", regionId: "north", pastorName: "André", displayOrder: 1 },
  { id: "independent", name: "Missão Independente", regionId: null, pastorName: null, displayOrder: 1 },
];

function registration(id: string, congregationId: string | null, roleId: string | null = null, roleName: string | null = null, gender: string | null = null) {
  return { id, congregationId, roleId, roleName, gender };
}

describe("aggregateEventGeneralReport", () => {
  it("consolida inscrições únicas, cotas e percentuais na ordem das regionais", () => {
    const result = aggregateEventGeneralReport({
      config: config(),
      regions,
      congregations,
      quotas: new Map([["bela-vista", 4], ["alvorada", 6], ["zion", 10]]),
      registrations: [
        registration("r1", "bela-vista", "deacon", "Diácono", "MALE"),
        registration("r1", "bela-vista", "deacon", "Diácono", "MALE"),
        registration("r2", "bela-vista", "deacon", "Diácono", "FEMALE"),
        registration("r3", "zion"),
      ],
    });

    expect(result.totalRegistrations).toBe(3);
    expect(result.regionRows.map((row) => row.name)).toEqual(["Regional Central", "Regional Norte", "Sem regional"]);
    expect(result.regionRows[0]).toMatchObject({ quota: 10, registrations: 2, percentage: 20 });
    expect(result.congregationRows.find((row) => row.id === "alvorada")).toMatchObject({ registrations: 0, quota: 6, percentage: 0 });
    expect(result.roleRows).toEqual([
      { id: "deacon", name: "Diácono", registrations: 2, unassigned: false },
      { id: "unassigned", name: "Sem cargo informado", registrations: 1, unassigned: true },
    ]);
    expect(result.genderRows).toEqual([
      { id: "FEMALE", name: "Feminino", registrations: 1 },
      { id: "MALE", name: "Masculino", registrations: 1 },
      { id: "UNSPECIFIED", name: "Não informado", registrations: 1 },
    ]);
  });

  it("inclui inscrições sem congregação e permite ocultar congregações zeradas", () => {
    const result = aggregateEventGeneralReport({
      config: config({ sections: { includeZeroCongregations: false } } as Partial<EventGeneralReportConfig>),
      regions,
      congregations,
      quotas: new Map(),
      registrations: [
        registration("r1", null),
        registration("r2", "missing"),
        registration("r3", "zion"),
      ],
    });

    expect(result.congregationRows.map((row) => [row.name, row.registrations])).toEqual([
      ["Zion", 1],
      ["Sem congregação", 2],
    ]);
    expect(result.regionRows.at(-1)).toMatchObject({ name: "Sem regional", registrations: 2 });
  });

  it("respeita o filtro regional e a organização alfabética", () => {
    const result = aggregateEventGeneralReport({
      config: config({
        filters: { regionId: "central" },
        organization: "ALPHABETICAL",
      } as Partial<EventGeneralReportConfig>),
      regions,
      congregations,
      quotas: new Map(),
      registrations: [
        registration("r1", "bela-vista"),
        registration("r2", "zion"),
      ],
    });

    expect(result.totalRegistrations).toBe(1);
    expect(result.regionRows.map((row) => row.id)).toEqual(["central"]);
    expect(result.congregationRows.map((row) => row.name)).toEqual(["Alvorada", "Bela Vista"]);
  });
});
