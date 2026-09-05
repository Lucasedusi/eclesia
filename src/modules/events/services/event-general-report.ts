import type {
  EventGeneralReportConfig,
  EventReportCongregationRow,
  EventReportCongregationSource,
  EventReportRegionRow,
  EventReportRegionSource,
  EventReportRegistrationSource,
  EventReportRoleRow,
  EventReportGenderRow,
} from "../types/event.types";

type AggregateInput = {
  config: EventGeneralReportConfig;
  regions: EventReportRegionSource[];
  congregations: EventReportCongregationSource[];
  registrations: EventReportRegistrationSource[];
  quotas: Map<string, number>;
};

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function percentage(registrations: number, quota: number | null) {
  return quota && quota > 0 ? Math.round((registrations / quota) * 100) : null;
}

function byRegionOrder(first: EventReportRegionRow, second: EventReportRegionRow) {
  if (first.unassigned !== second.unassigned) return first.unassigned ? 1 : -1;
  return first.displayOrder - second.displayOrder || collator.compare(first.name, second.name);
}

export function aggregateEventGeneralReport(input: AggregateInput) {
  const { config } = input;
  const regionById = new Map(input.regions.map((region) => [region.id, region]));
  const congregationById = new Map(input.congregations.map((congregation) => [congregation.id, congregation]));
  const selectedCongregation = config.filters.congregationId
    ? congregationById.get(config.filters.congregationId)
    : null;

  const scopedCongregations = input.congregations.filter((congregation) => {
    if (config.filters.congregationId) return congregation.id === config.filters.congregationId;
    if (config.filters.regionId) return congregation.regionId === config.filters.regionId;
    return true;
  });
  const scopedCongregationIds = new Set(scopedCongregations.map((congregation) => congregation.id));

  const uniqueRegistrations = new Map(input.registrations.map((registration) => [registration.id, registration]));
  const registrations = [...uniqueRegistrations.values()].filter((registration) => {
    if (config.filters.congregationId) return registration.congregationId === config.filters.congregationId;
    if (config.filters.regionId) {
      return Boolean(registration.congregationId && scopedCongregationIds.has(registration.congregationId));
    }
    return true;
  });

  const roleCounts = new Map<string, { name: string; registrations: number; unassigned: boolean }>();
  for (const registration of registrations) {
    const roleId = registration.roleId || "unassigned";
    const current = roleCounts.get(roleId);
    roleCounts.set(roleId, {
      name: registration.roleName || (registration.roleId ? "Cargo não identificado" : "Sem cargo informado"),
      registrations: (current?.registrations ?? 0) + 1,
      unassigned: !registration.roleId,
    });
  }
  const roleRows: EventReportRoleRow[] = [...roleCounts.entries()]
    .map(([id, role]) => ({ id, ...role }))
    .sort((first, second) => {
      if (first.unassigned !== second.unassigned) return first.unassigned ? 1 : -1;
      return collator.compare(first.name, second.name);
    });

  const genderLabels: Record<EventReportGenderRow["id"], string> = {
    FEMALE: "Feminino",
    MALE: "Masculino",
    UNSPECIFIED: "Não informado",
  };
  const genderCounts = new Map<EventReportGenderRow["id"], number>();
  for (const registration of registrations) {
    const genderId: EventReportGenderRow["id"] = registration.gender === "FEMALE"
      ? "FEMALE"
      : registration.gender === "MALE"
        ? "MALE"
        : "UNSPECIFIED";
    genderCounts.set(genderId, (genderCounts.get(genderId) ?? 0) + 1);
  }
  const genderOrder: EventReportGenderRow["id"][] = ["FEMALE", "MALE", "UNSPECIFIED"];
  const genderRows: EventReportGenderRow[] = genderOrder
    .filter((id) => genderCounts.has(id))
    .map((id) => ({ id, name: genderLabels[id], registrations: genderCounts.get(id) ?? 0 }));

  const countByCongregation = new Map<string, number>();
  let unassignedRegistrations = 0;
  for (const registration of registrations) {
    if (!registration.congregationId || !congregationById.has(registration.congregationId)) {
      unassignedRegistrations += 1;
      continue;
    }
    countByCongregation.set(
      registration.congregationId,
      (countByCongregation.get(registration.congregationId) ?? 0) + 1,
    );
  }

  let congregationRows: EventReportCongregationRow[] = scopedCongregations.map((congregation) => {
    const region = congregation.regionId ? regionById.get(congregation.regionId) : null;
    const quota = input.quotas.get(congregation.id) ?? null;
    const registrationCount = countByCongregation.get(congregation.id) ?? 0;
    return {
      id: congregation.id,
      name: congregation.name,
      pastorName: congregation.pastorName,
      regionId: congregation.regionId,
      regionName: region?.name ?? "Sem regional",
      regionDisplayOrder: region?.displayOrder ?? Number.MAX_SAFE_INTEGER,
      quota,
      registrations: registrationCount,
      percentage: percentage(registrationCount, quota),
      unassigned: false,
    };
  });

  if (!config.filters.regionId && !config.filters.congregationId && unassignedRegistrations > 0) {
    congregationRows.push({
      id: "unassigned",
      name: "Sem congregação",
      pastorName: null,
      regionId: null,
      regionName: "Sem regional",
      regionDisplayOrder: Number.MAX_SAFE_INTEGER,
      quota: null,
      registrations: unassignedRegistrations,
      percentage: null,
      unassigned: true,
    });
  }

  if (!config.sections.includeZeroCongregations) {
    congregationRows = congregationRows.filter((congregation) => congregation.registrations > 0);
  }

  const regionScope = input.regions.filter((region) => {
    if (config.filters.regionId) return region.id === config.filters.regionId;
    if (selectedCongregation) return selectedCongregation.regionId === region.id;
    return true;
  });

  const regionRows: EventReportRegionRow[] = regionScope.map((region) => {
    const congregations = scopedCongregations.filter((congregation) => congregation.regionId === region.id);
    const registrations = congregations.reduce(
      (sum, congregation) => sum + (countByCongregation.get(congregation.id) ?? 0),
      0,
    );
    const configuredQuotas = congregations
      .map((congregation) => input.quotas.get(congregation.id))
      .filter((quota): quota is number => typeof quota === "number");
    const quota = configuredQuotas.length
      ? configuredQuotas.reduce((sum, current) => sum + current, 0)
      : null;
    return {
      id: region.id,
      name: region.name,
      coordinatorName: region.coordinatorName,
      quota,
      registrations,
      percentage: percentage(registrations, quota),
      displayOrder: region.displayOrder,
      unassigned: false,
    };
  });

  const unassignedCongregations = scopedCongregations.filter((congregation) => !congregation.regionId);
  if (!config.filters.regionId && (!selectedCongregation || !selectedCongregation.regionId) && (unassignedCongregations.length || unassignedRegistrations)) {
    const configuredQuotas = unassignedCongregations
      .map((congregation) => input.quotas.get(congregation.id))
      .filter((quota): quota is number => typeof quota === "number");
    const registrations = unassignedCongregations.reduce(
      (sum, congregation) => sum + (countByCongregation.get(congregation.id) ?? 0),
      unassignedRegistrations,
    );
    const quota = configuredQuotas.length
      ? configuredQuotas.reduce((sum, current) => sum + current, 0)
      : null;
    regionRows.push({
      id: "unassigned",
      name: "Sem regional",
      coordinatorName: null,
      quota,
      registrations,
      percentage: percentage(registrations, quota),
      displayOrder: Number.MAX_SAFE_INTEGER,
      unassigned: true,
    });
  }

  regionRows.sort(byRegionOrder);
  congregationRows.sort((first, second) => {
    if (config.organization === "ALPHABETICAL") {
      return collator.compare(first.name, second.name);
    }
    if (first.regionDisplayOrder !== second.regionDisplayOrder) {
      return first.regionDisplayOrder - second.regionDisplayOrder;
    }
    const regionComparison = collator.compare(first.regionName, second.regionName);
    return regionComparison || collator.compare(first.name, second.name);
  });

  return {
    totalRegistrations: registrations.length,
    regionRows,
    congregationRows,
    roleRows,
    genderRows,
  };
}
