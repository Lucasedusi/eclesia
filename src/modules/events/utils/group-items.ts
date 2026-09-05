export type GroupItemSelection = { itemId: string; quantity: number };
export type RequiredGroupItem = { id: string; minQuantity: number };

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
