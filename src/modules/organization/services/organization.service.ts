import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type {
  CongregationItem,
  OrganizationData,
  OrganizationOption,
  PositionItem,
  RegionItem,
} from "../types/organization.types";

type NamedRelation = { name: string } | { name: string }[] | null;

type RegionRow = {
  id: string;
  name: string;
  description: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  display_order: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

type CongregationRow = {
  id: string;
  region_id: string | null;
  name: string;
  code: string | null;
  pastor_name: string | null;
  pastor_spouse_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  zip_code: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string;
  notes: string | null;
  is_headquarters: boolean;
  display_order: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
  regions: NamedRelation;
};

type PositionRow = {
  id: string;
  name: string;
  female_name: string | null;
  abbreviation: string | null;
  female_abbreviation: string | null;
  description: string | null;
  display_order: number;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function loadOrganizationRows() {
  const context = await requireAccessContext(PERMISSIONS.organizationView);
  const supabase = await createClient();

  const [regionsResult, congregationsResult, positionsResult] = await Promise.all([
    supabase
      .from("regions")
      .select("id, name, description, coordinator_name, coordinator_phone, display_order, status, created_at, updated_at")
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .order("display_order")
      .order("name")
      .order("id"),
    supabase
      .from("congregations")
      .select("id, region_id, name, code, pastor_name, pastor_spouse_name, phone, whatsapp, email, zip_code, address, number, complement, district, city, state, country, notes, is_headquarters, display_order, status, created_at, updated_at, regions(name)")
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .order("display_order")
      .order("name")
      .order("id"),
    supabase
      .from("roles")
      .select("id, name, female_name, abbreviation, female_abbreviation, description, display_order, status, created_at, updated_at")
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .order("display_order")
      .order("name")
      .order("id"),
  ]);

  const failures = [
    { query: "regions", error: regionsResult.error },
    { query: "congregations", error: congregationsResult.error },
    { query: "positions", error: positionsResult.error },
  ].filter((entry) => entry.error);

  if (failures.length > 0) {
    console.error(
      "[organization] Failed to load ecclesiastical structure",
      failures.map(({ query, error }) => ({
        query,
        code: error?.code,
        message: error?.message,
      })),
    );
    throw new Error("ORGANIZATION_DATA_LOAD_FAILED");
  }

  return {
    context,
    regionRows: (regionsResult.data ?? []) as RegionRow[],
    congregationRows: (congregationsResult.data ?? []) as unknown as CongregationRow[],
    positionRows: (positionsResult.data ?? []) as PositionRow[],
  };
}

function mapCongregation(row: CongregationRow): CongregationItem {
  const region = first(row.regions);
  return {
    id: row.id,
    regionId: row.region_id,
    regionName: region?.name ?? null,
    name: row.name,
    code: row.code,
    pastorName: row.pastor_name,
    pastorSpouseName: row.pastor_spouse_name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    zipCode: row.zip_code,
    address: row.address,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    country: row.country,
    notes: row.notes,
    isHeadquarters: row.is_headquarters,
    displayOrder: row.display_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPosition(row: PositionRow): PositionItem {
  return {
    id: row.id,
    name: row.name,
    femaleName: row.female_name,
    abbreviation: row.abbreviation,
    femaleAbbreviation: row.female_abbreviation,
    description: row.description,
    displayOrder: row.display_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrganizationData(): Promise<OrganizationData> {
  const { context, regionRows, congregationRows, positionRows } = await loadOrganizationRows();
  const congregations = congregationRows.map(mapCongregation);
  const positions = positionRows.map(mapPosition);

  const regions: RegionItem[] = regionRows.map((row) => {
    const linked = congregations.filter((congregation) => congregation.regionId === row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coordinatorName: row.coordinator_name,
      coordinatorPhone: row.coordinator_phone,
      displayOrder: row.display_order,
      status: row.status,
      congregationCount: linked.length,
      activeCongregationCount: linked.filter((item) => item.status === "ACTIVE").length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const isAdministrator = context.access.role === "ADMIN" && context.access.scope === "CHURCH";

  return {
    regions,
    congregations,
    positions,
    activeRegionOptions: regions
      .filter((region) => region.status === "ACTIVE")
      .map(({ id, name }) => ({ id, name })),
    stats: {
      activeRegions: regions.filter((region) => region.status === "ACTIVE").length,
      activeCongregations: congregations.filter((item) => item.status === "ACTIVE").length,
      inactiveCongregations: congregations.filter((item) => item.status === "INACTIVE").length,
      congregationsWithoutRegion: congregations.filter(
        (item) => !item.isHeadquarters && !item.regionId,
      ).length,
      activePositions: positions.filter((position) => position.status === "ACTIVE").length,
    },
    management: {
      regions: isAdministrator && context.permissions.includes(PERMISSIONS.regionsManage),
      congregations:
        isAdministrator && context.permissions.includes(PERMISSIONS.congregationsManage),
      positions: isAdministrator && context.permissions.includes(PERMISSIONS.positionsManage),
    },
  };
}

export async function listRegions(): Promise<RegionItem[]> {
  return (await getOrganizationData()).regions;
}

export async function listCongregations(): Promise<CongregationItem[]> {
  return (await getOrganizationData()).congregations;
}

export async function listPositions(): Promise<PositionItem[]> {
  return (await getOrganizationData()).positions;
}

export async function getRegionOptions(): Promise<OrganizationOption[]> {
  return (await getOrganizationData()).activeRegionOptions;
}

export async function getCongregationOptions(): Promise<OrganizationOption[]> {
  return (await getOrganizationData()).congregations
    .filter((item) => item.status === "ACTIVE")
    .map(({ id, name }) => ({ id, name }));
}

export async function getPositionOptions(): Promise<OrganizationOption[]> {
  return (await getOrganizationData()).positions
    .filter((item) => item.status === "ACTIVE")
    .map(({ id, name }) => ({ id, name }));
}

