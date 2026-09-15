import type { MemberEventItem } from "../types/member.types";

type MemberEventRow = {
  id: string;
  name: string;
  starts_at: string;
  location_name: string | null;
  city: string | null;
  state: string | null;
};

export function toMemberEventItem(row: MemberEventRow): MemberEventItem {
  const cityAndState = [row.city, row.state].filter(Boolean).join(" / ");
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    location: [row.location_name, cityAndState].filter(Boolean).join(" · ") || "Local não informado",
  };
}
