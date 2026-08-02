import Link from "next/link";
import { Ban, Clock3, LogOut, ShieldX } from "lucide-react";
import { logoutAction } from "../../actions/auth.actions";
import * as S from "./access-state.styles";

type AccessStateProps = {
  variant: "denied" | "unavailable" | "waiting";
};

const content = {
  denied: {
    title: "Acesso não permitido",
    text: "Sua conta está ativa, mas não possui a permissão necessária para visualizar esta página. Se precisar desse recurso, solicite a liberação a um Administrador da Igreja.",
    icon: ShieldX,
  },
  unavailable: {
    title: "Acesso indisponível",
    text: "Seu perfil ou vínculo de acesso está inativo ou bloqueado. Entre em contato com um Administrador para verificar a situação da sua conta.",
    icon: Ban,
  },
  waiting: {
    title: "Aguardando liberação",
    text: "Sua conta foi identificada, mas ainda não possui um acesso ativo. Abra o convite recebido por e-mail ou aguarde a liberação do Administrador.",
    icon: Clock3,
  },
} as const;

export function AccessState({ variant }: AccessStateProps) {
  const item = content[variant];
  const Icon = item.icon;
  return (
    <S.Page>
      <S.Card>
        <S.Icon $danger={variant !== "waiting"}><Icon size={30} /></S.Icon>
        <S.Title>{item.title}</S.Title>
        <S.Text>{item.text}</S.Text>
        <S.Actions>
          {variant === "denied" ? <Link href="/">Voltar ao início</Link> : <Link href="/login">Ir para o login</Link>}
          <form action={logoutAction}><button type="submit"><LogOut size={16} /> Encerrar sessão</button></form>
        </S.Actions>
      </S.Card>
    </S.Page>
  );
}
