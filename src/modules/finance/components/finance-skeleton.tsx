export function FinanceSkeleton({ table = false }: { table?: boolean }) {
  const block = (height: number, width = "100%") => (
    <div
      className="finance-skeleton-block"
      style={{ height, width, borderRadius: 8, background: "#e5eee9" }}
    />
  );
  return (
    <div
      role="status"
      aria-label={table ? "Carregando lançamentos" : "Carregando financeiro"}
      className="finance-skeleton"
      style={{
        display: "grid",
        gap: 18,
        padding: table ? 0 : 24,
        minHeight: table ? 280 : 440,
      }}
    >
      {!table && (
        <>
          <div aria-hidden="true">{block(28, "45%")}</div>
          <div
            aria-hidden="true"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 16,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i}>{block(125)}</div>
            ))}
          </div>
        </>
      )}
      <div aria-hidden="true" style={{ display: "grid", gap: 18 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>{block(32, i % 2 ? "90%" : "100%")}</div>
        ))}
      </div>
    </div>
  );
}
