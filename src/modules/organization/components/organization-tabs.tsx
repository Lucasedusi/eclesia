"use client";

import { usePathname } from "next/navigation";
import { BadgeCheck, Church, Network } from "lucide-react";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import * as S from "./organization.styles";

const tabs = [
  { href: "/estrutura-eclesiastica/regionais", label: "Regionais", icon: Network },
  { href: "/estrutura-eclesiastica/congregacoes", label: "Congregações", icon: Church },
  { href: "/estrutura-eclesiastica/cargos", label: "Cargos", icon: BadgeCheck },
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
