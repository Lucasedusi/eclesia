"use client";

import { usePathname } from "next/navigation";
import type { OrganizationData, OrganizationTab } from "../types/organization.types";
import { OrganizationManagement } from "./organization-management";

function tabFromPathname(pathname: string): OrganizationTab {
  if (pathname.endsWith("/congregacoes")) return "congregations";
  if (pathname.endsWith("/cargos")) return "positions";
  return "regions";
}

export function OrganizationWorkspace({ data }: { data: OrganizationData }) {
  const pathname = usePathname();
  const activeTab = tabFromPathname(pathname);
  return <OrganizationManagement key={activeTab} data={data} activeTab={activeTab} />;
}
