type PageSkeletonProps = {
  variant?: "dashboard" | "table" | "form" | "details";
  label?: string;
};

function Block({ className = "" }: { className?: string }) {
  return <span className={`app-skeleton-block ${className}`} aria-hidden="true" />;
}

export function PageSkeleton({
  variant = "table",
  label = "Carregando conteúdo",
}: PageSkeletonProps) {
  if (variant === "form") {
    return (
      <section className="app-page-skeleton" aria-busy="true" aria-label={label}>
        <header className="app-skeleton-heading">
          <div><Block className="app-skeleton-title" /><Block className="app-skeleton-subtitle" /></div>
          <Block className="app-skeleton-action" />
        </header>
        <div className="app-skeleton-form">
          <aside>{Array.from({ length: 5 }, (_, index) => <Block key={index} className="app-skeleton-step" />)}</aside>
          <div className="app-skeleton-fields">
            <Block className="app-skeleton-section-title" />
            {Array.from({ length: 8 }, (_, index) => <Block key={index} className="app-skeleton-field" />)}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "dashboard") {
    return (
      <section className="app-page-skeleton" aria-busy="true" aria-label={label}>
        <header className="app-skeleton-heading"><div><Block className="app-skeleton-title" /><Block className="app-skeleton-subtitle" /></div></header>
        <div className="app-skeleton-stats">{Array.from({ length: 4 }, (_, index) => <Block key={index} className="app-skeleton-stat" />)}</div>
        <div className="app-skeleton-dashboard-grid"><Block className="app-skeleton-chart" /><Block className="app-skeleton-chart" /></div>
      </section>
    );
  }

  if (variant === "details") {
    return (
      <section className="app-page-skeleton" aria-busy="true" aria-label={label}>
        <header className="app-skeleton-heading"><div><Block className="app-skeleton-title" /><Block className="app-skeleton-subtitle" /></div></header>
        <div className="app-skeleton-details"><Block /><Block /><Block /></div>
      </section>
    );
  }

  return (
    <section className="app-page-skeleton" aria-busy="true" aria-label={label}>
      <header className="app-skeleton-heading">
        <div><Block className="app-skeleton-title" /><Block className="app-skeleton-subtitle" /></div>
        <Block className="app-skeleton-action" />
      </header>
      <div className="app-skeleton-stats">{Array.from({ length: 5 }, (_, index) => <Block key={index} className="app-skeleton-stat" />)}</div>
      <div className="app-skeleton-panel">
        <Block className="app-skeleton-toolbar" />
        {Array.from({ length: 6 }, (_, index) => <Block key={index} className="app-skeleton-row" />)}
      </div>
    </section>
  );
}

export function AuthenticatedShellSkeleton() {
  return (
    <div className="app-shell-skeleton" aria-busy="true" aria-label="Preparando área segura">
      <aside aria-hidden="true"><Block className="app-shell-skeleton-logo" />{Array.from({ length: 7 }, (_, index) => <Block key={index} className="app-shell-skeleton-link" />)}</aside>
      <div><header><Block className="app-shell-skeleton-greeting" /><Block className="app-shell-skeleton-avatar" /></header><main><PageSkeleton /></main></div>
    </div>
  );
}
