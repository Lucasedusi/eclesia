import * as S from "./member-credential.styles";

export function MemberCredentialSkeleton() {
  return (
    <S.PreviewStage
      role="status"
      aria-live="polite"
      aria-label="Preparando a credencial"
      aria-busy="true"
    >
      <S.SkeletonCard aria-hidden="true">
        <div className="credential-skeleton-header">
          <span className="app-skeleton-block credential-skeleton-logo" />
          <div className="credential-skeleton-church">
            <span className="app-skeleton-block" />
            <span className="app-skeleton-block" />
            <span className="app-skeleton-block" />
          </div>
        </div>
        <div className="credential-skeleton-gold" />
        <div className="credential-skeleton-body">
          <span className="app-skeleton-block credential-skeleton-qr" />
          <div className="credential-skeleton-fields">
            <span className="app-skeleton-block credential-skeleton-name" />
            <span className="app-skeleton-block credential-skeleton-role" />
            <span className="credential-skeleton-rule" />
            <span className="app-skeleton-block credential-skeleton-label" />
            <span className="app-skeleton-block credential-skeleton-value" />
            <span className="credential-skeleton-rule" />
            <span className="app-skeleton-block credential-skeleton-label" />
            <span className="app-skeleton-block credential-skeleton-value" />
          </div>
        </div>
      </S.SkeletonCard>
      <S.SkeletonHint
        className="app-skeleton-block"
        aria-hidden="true"
      />
    </S.PreviewStage>
  );
}
