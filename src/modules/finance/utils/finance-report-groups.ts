type ClassifiedAmount = {
  classificationId: string | null;
  classificationName: string | null;
  amountCents: number;
};

/** Group recorded classifications without consulting a person's current role. */
export function groupReportClassifications<T extends ClassifiedAmount>(
  rows: T[],
) {
  return [
    ...Map.groupBy(rows, (row) =>
      JSON.stringify([row.classificationId, row.classificationName]),
    ).values(),
  ].map((group) => ({
    name: group[0].classificationName || "Sem classificação",
    rows: group,
    totalCents: group.reduce((total, row) => total + row.amountCents, 0),
  }));
}
