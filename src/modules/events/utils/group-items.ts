export type GroupItemSelection = { itemId: string; quantity: number };
export type RequiredGroupItem = { id: string; minQuantity: number };
export type CaravanSortOrder =
  | "NEWEST"
  | "MOST_REGISTRATIONS"
  | "LEAST_REGISTRATIONS"
  | "ALPHABETICAL_ASC"
  | "ALPHABETICAL_DESC";

type SortableCaravan = {
  id: string;
  originChurchName: string;
  originCity: string;
  total: number;
  createdAt: string;
};

export function mergeRequiredGroupItems(
  selectedItems: GroupItemSelection[],
  requiredItems: RequiredGroupItem[],
) {
  const merged = selectedItems.map((item) => ({ ...item }));

  for (const required of requiredItems) {
    const minimum = Math.max(required.minQuantity, 1);
    const selected = merged.find((item) => item.itemId === required.id);
    if (selected) selected.quantity = Math.max(selected.quantity, minimum);
    else merged.push({ itemId: required.id, quantity: minimum });
  }

  return merged;
}

export function sortCaravans<T extends SortableCaravan>(rows: T[], order: CaravanSortOrder) {
  return [...rows].sort((first, second) => {
    if (order === "MOST_REGISTRATIONS") return second.total - first.total || first.originChurchName.localeCompare(second.originChurchName, "pt-BR");
    if (order === "LEAST_REGISTRATIONS") return first.total - second.total || first.originChurchName.localeCompare(second.originChurchName, "pt-BR");
    if (order === "ALPHABETICAL_ASC") return first.originChurchName.localeCompare(second.originChurchName, "pt-BR", { sensitivity: "base" }) || first.originCity.localeCompare(second.originCity, "pt-BR", { sensitivity: "base" });
    if (order === "ALPHABETICAL_DESC") return second.originChurchName.localeCompare(first.originChurchName, "pt-BR", { sensitivity: "base" }) || second.originCity.localeCompare(first.originCity, "pt-BR", { sensitivity: "base" });
    return second.createdAt.localeCompare(first.createdAt) || first.id.localeCompare(second.id);
  });
}
