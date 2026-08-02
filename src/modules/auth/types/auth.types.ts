export const ACCESS_ROLES = [
  "ADMIN",
  "SECRETARY",
  "TREASURER",
  "LEADER",
  "MINISTRY_LEADER",
  "VIEWER",
] as const;

export const ACCESS_SCOPES = [
  "CHURCH",
  "REGION",
  "CONGREGATION",
  "MINISTRY",
] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];
export type AccessScope = (typeof ACCESS_SCOPES)[number];
export type AccessStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type ProfileStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "BLOCKED";

export type ChurchSummary = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type ProfileSummary = {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: ProfileStatus;
};

export type AccessSummary = {
  id: string;
  churchId: string;
  role: AccessRole;
  scope: AccessScope;
  status: AccessStatus;
  regionId: string | null;
  congregationId: string | null;
  ministryId: string | null;
};

export type AuthContext = {
  profile: ProfileSummary;
  church: ChurchSummary;
  access: AccessSummary;
  accesses: AccessSummary[];
  availableChurches: ChurchSummary[];
  permissions: string[];
};

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string[]>;
  meta?: Record<string, string>;
};

export const INITIAL_ACTION_STATE: ActionState = {
  status: "idle",
  message: "",
};

export const ROLE_LABELS: Record<AccessRole, string> = {
  ADMIN: "Administrador da Igreja",
  SECRETARY: "Secretário",
  TREASURER: "Tesoureiro",
  LEADER: "Líder",
  MINISTRY_LEADER: "Líder de Ministério",
  VIEWER: "Visualizador",
};

export const SCOPE_LABELS: Record<AccessScope, string> = {
  CHURCH: "Toda a igreja",
  REGION: "Regional",
  CONGREGATION: "Congregação",
  MINISTRY: "Ministério",
};
