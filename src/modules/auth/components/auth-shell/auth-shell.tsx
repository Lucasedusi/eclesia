import { Building2, CheckCircle2, Church, Users, Wallet } from "lucide-react";
import { APP_CONFIG } from "@/constants/app";
import * as S from "./auth-shell.styles";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <S.Page>
      <S.FormPanel>
        <S.FormContent>{children}</S.FormContent>
      </S.FormPanel>

      <S.VisualPanel aria-label={`Sobre o ${APP_CONFIG.name}`}>
        <S.VisualFrame>
          <S.VisualBrand>
            <S.VisualBrandMark><Building2 /></S.VisualBrandMark>
            <S.VisualBrandText>
              <strong>{APP_CONFIG.name}</strong>
              <span>Gestão de igrejas</span>
            </S.VisualBrandText>
          </S.VisualBrand>

          <S.VisualContent>
            <S.VisualBadge>
              <CheckCircle2 size={15} /> Gestão simples, segura e organizada
            </S.VisualBadge>
            <S.VisualTitle>
              Toda a secretaria da sua igreja em um só lugar.
            </S.VisualTitle>
            <S.ModuleList aria-label="Módulos do sistema">
              <li><Users aria-hidden="true" />Membros</li>
              <li><Church aria-hidden="true" />Congregações</li>
              <li><Wallet aria-hidden="true" />Financeiro</li>
            </S.ModuleList>
          </S.VisualContent>
        </S.VisualFrame>
      </S.VisualPanel>
    </S.Page>
  );
}

export function AuthBrand({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  return (
    <S.Brand $alwaysVisible={alwaysVisible}>
      <S.BrandMark><Building2 /></S.BrandMark>
      <S.BrandText><strong>{APP_CONFIG.name}</strong><span>Gestão de igrejas</span></S.BrandText>
    </S.Brand>
  );
}

export function AuthFormCard({ children, loading = false }: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <S.LoginStack aria-busy={loading || undefined} aria-label={loading ? "Preparando formulário de acesso" : undefined}>
      <S.LoginBrandSlot><AuthBrand alwaysVisible /></S.LoginBrandSlot>
      <S.LoginCard>{children}</S.LoginCard>
    </S.LoginStack>
  );
}
