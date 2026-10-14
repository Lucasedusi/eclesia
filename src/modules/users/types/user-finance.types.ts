export type UserFinanceAssignment = {
  accessId: string;
  unitId: string | null;
  units: { id: string; name: string }[];
};
export type UserFinanceOperations = {
  authorizationUnitId: string;
  assignments: UserFinanceAssignment[];
};
