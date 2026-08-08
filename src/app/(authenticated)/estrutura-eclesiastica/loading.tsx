import * as S from "@/modules/organization/components/organization.styles";

export default function LoadingEcclesiasticalStructure() {
  return (
    <S.Module aria-busy="true" aria-label="Carregando estrutura eclesiástica">
      <S.SkeletonGrid>{Array.from({ length: 5 }, (_, index) => <S.Skeleton key={index} $height="72px" />)}</S.SkeletonGrid>
      <S.Skeleton $height="390px" />
    </S.Module>
  );
}
