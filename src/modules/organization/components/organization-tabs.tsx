"use client";

import { usePathname } from "next/navigation";
import { Church, Network } from "lucide-react";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import * as S from "./organization.styles";

const tabs = [
  { href: "/estrutura-eclesiastica/regionais", label: "Regionais", icon: Network },
  { href: "/estrutura-eclesiastica/congregacoes", label: "Congregações", icon: Church },
];

export function OrganizationTabs() {
  const pathname = usePathname();
  return (
    <S.Tabs aria-label="Seções da estrutura eclesiástica">
      {tabs.map(({ href, label, icon: Icon }) => (
        <S.Tab key={href} href={href} $active={pathname === href} aria-current={pathname === href ? "page" : undefined}>
          <Icon size={15} aria-hidden="true" /> {label}<LinkPendingIndicator />
        </S.Tab>
      ))}
    </S.Tabs>
  );
}
