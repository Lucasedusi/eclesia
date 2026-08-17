import { AuthBrand } from "./auth-shell/auth-shell";
import * as S from "./auth-shell/auth-shell.styles";

export function LoginFormSkeleton() {
  return (
    <S.LoginStack aria-busy="true" aria-label="Preparando formulário de acesso">
      <S.LoginBrandSlot>
        <AuthBrand alwaysVisible />
      </S.LoginBrandSlot>

      <S.LoginCard>
        <S.LoginSkeletonLine $width="58%" $height="38px" />
        <S.LoginSkeletonLine $width="92%" $height="13px" $marginTop="15px" />
        <S.LoginSkeletonLine $width="72%" $height="13px" $marginTop="8px" />

        <S.LoginSkeletonForm aria-hidden="true">
          <div>
            <S.LoginSkeletonLine $width="24%" $height="13px" />
            <S.LoginSkeletonLine $width="100%" $height="54px" $marginTop="9px" />
          </div>
          <div>
            <S.LoginSkeletonFieldTop>
              <S.LoginSkeletonLine $width="22%" $height="13px" />
              <S.LoginSkeletonLine $width="32%" $height="11px" />
            </S.LoginSkeletonFieldTop>
            <S.LoginSkeletonLine $width="100%" $height="54px" $marginTop="9px" />
          </div>
          <S.LoginSkeletonLine $width="100%" $height="54px" />
        </S.LoginSkeletonForm>
      </S.LoginCard>
    </S.LoginStack>
  );
}
