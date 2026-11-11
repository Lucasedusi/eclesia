import { Cake, UsersRound } from "lucide-react";
import { Tabs, Tab } from "@/modules/organization/components/organization.styles";

export function MemberListTabs({ active }: { active: "list" | "birthdays" }) {
  return <Tabs aria-label="Consultas de membros">
    <Tab href="/membros" $active={active === "list"} aria-current={active === "list" ? "page" : undefined}>
      <UsersRound size={16} aria-hidden /> Listagem
    </Tab>
    <Tab href="/membros/aniversariantes" $active={active === "birthdays"} aria-current={active === "birthdays" ? "page" : undefined}>
      <Cake size={16} aria-hidden /> Aniversariantes
    </Tab>
  </Tabs>;
}
