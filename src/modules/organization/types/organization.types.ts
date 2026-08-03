export type OrganizationStatus = "ACTIVE" | "INACTIVE";

export type RegionItem = {
  id: string;
  name: string;
  description: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  displayOrder: number;
  status: OrganizationStatus;
  congregationCount: number;
  activeCongregationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CongregationItem = {
  id: string;
  regionId: string | null;
  regionName: string | null;
  name: string;
  code: string | null;
  pastorName: string | null;
  pastorSpouseName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  zipCode: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string;
  notes: string | null;
  isHeadquarters: boolean;
  displayOrder: number;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
};

export type PositionItem = {
  id: string;
  name: string;
  femaleName: string | null;
  abbreviation: string | null;
  femaleAbbreviation: string | null;
  description: string | null;
  displayOrder: number;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationOption = {
  id: string;
  name: string;
};

export type OrganizationStats = {
  activeRegions: number;
  activeCongregations: number;
  inactiveCongregations: number;
  congregationsWithoutRegion: number;
  activePositions: number;
};

export type OrganizationManagement = {
  regions: boolean;
  congregations: boolean;
  positions: boolean;
};

export type OrganizationData = {
  regions: RegionItem[];
  congregations: CongregationItem[];
  positions: PositionItem[];
  activeRegionOptions: OrganizationOption[];
  stats: OrganizationStats;
  management: OrganizationManagement;
};

export type OrganizationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const INITIAL_ORGANIZATION_ACTION_STATE: OrganizationActionState = {
  status: "idle",
  message: "",
};

export type OrganizationTab = "regions" | "congregations" | "positions";

