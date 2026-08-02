import { Building2, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import * as S from "./auth-shell.styles";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <S.Page>
      <S.FormPanel>
        <S.FormContent>{children}</S.FormContent>
      </S.FormPanel>

      <S.VisualPanel aria-hidden="true">
        <S.VisualContent>
          <S.VisualBadge>
            <CheckCircle2 size={15} /> Gestão simples, segura e organizada
          </S.VisualBadge>
          <S.VisualTitle>
            Toda a secretaria da sua igreja em um só lugar.
          </S.VisualTitle>
          <S.Preview>
            <S.PreviewTop>
              <div><span>VISÃO GERAL</span><strong>Comunidade em movimento</strong></div>
              <S.Today>Hoje</S.Today>
            </S.PreviewTop>
            <S.PreviewStats>
              <S.PreviewStat><Users size={20} /><div><strong>1.284</strong><small>Membros</small></div></S.PreviewStat>
              <S.PreviewStat><Building2 size={20} /><div><strong>18</strong><small>Congregações</small></div></S.PreviewStat>
              <S.PreviewStat><ShieldCheck size={20} /><div><strong>100%</strong><small>Acesso protegido</small></div></S.PreviewStat>
            </S.PreviewStats>
            <S.Bars>
              {[42, 65, 54, 79, 60, 73, 88, 69, 84].map((height, index) => (
                <S.Bar key={index} $height={height} />
              ))}
            </S.Bars>
          </S.Preview>
        </S.VisualContent>
      </S.VisualPanel>
    </S.Page>
  );
}

export function AuthBrand() {
  return (
    <S.Brand>
      <S.BrandMark><Building2 /></S.BrandMark>
      <S.BrandText><strong>Eclesias</strong><span>Gestão para igrejas</span></S.BrandText>
    </S.Brand>
  );
}
