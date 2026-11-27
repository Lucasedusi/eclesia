import type { CSSProperties } from "react";

export function ResultsSkeleton({ label, columns, rows = 5 }: { label: string; columns: number; rows?: number }) {
  return <div className="app-results-skeleton" role="status" aria-label={label} aria-busy="true"
    style={{ "--result-columns": columns } as CSSProperties}>
    {Array.from({ length: rows }, (_, row) => <div key={row} aria-hidden="true">
      {Array.from({ length: columns }, (_, column) => <span className="app-skeleton-block" key={column} />)}
    </div>)}
  </div>;
}
