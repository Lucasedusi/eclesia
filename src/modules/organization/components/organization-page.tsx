import { getOrganizationData } from "../services/organization.service";
import type { OrganizationTab } from "../types/organization.types";
import { OrganizationManagement } from "./organization-management";

export async function OrganizationPage({ tab }: { tab: OrganizationTab }) {
  const data = await getOrganizationData();
  return <OrganizationManagement key={tab} data={data} activeTab={tab} />;
}
