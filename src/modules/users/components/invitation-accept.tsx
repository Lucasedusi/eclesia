"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Church,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  INITIAL_ACTION_STATE,
  ROLE_LABELS,
  SCOPE_LABELS,
  type AccessRole,
  type AccessScope,
} from "@/modules/auth/types/auth.types";
import { acceptInvitationAction } from "../actions/invitation.actions";
import * as S from "./invitation-accept.styles";

type Props = {
  token: string;
  preview: {
    invitedName: string;
    email: string;
    churchName: string;
    role: AccessRole;
    scope: AccessScope;
    expiresAt: string;
    accountMode: "SET_PASSWORD" | "SIGN_IN";
  } | null;
};

export function InvitationAccept({ token, preview }: Props) {
  const [state, action, pending] = useActionState(
    acceptInvitationAction,
    INITIAL_ACTION_STATE,
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  if (!preview) {
    return (
      <S.Page>
        <S.Card>
          <S.Icon $danger><Clock3 size={30} /></S.Icon>
          <S.Title>Convite indisponível</S.Title>
          <S.Text>Este convite não existe, expirou, foi cancelado ou já foi utilizado.</S.Text>
          <S.Actions><Link href="/login">Voltar ao login</Link></S.Actions>
        </S.Card>
      </S.Page>
    );
  }

  const existingAccount = preview.accountMode === "SIGN_IN";
  const passwordLabel = existingAccount ? "Senha atual" : "Nova senha";

  return (
    <S.Page>
      <S.Card>
        <S.Brand><Church size={20} /><strong>Eclésias</strong></S.Brand>
        <S.Icon><ShieldCheck size={30} /></S.Icon>
        <S.Eyebrow>Convite de acesso</S.Eyebrow>
        <S.Title>{existingAccount ? "Confirme seu acesso" : "Crie sua senha"}</S.Title>
        <S.Text>
          {existingAccount ? (
            <>Este e-mail já possui uma conta. Digite a senha atual para aceitar o acesso a <strong>{preview.churchName}</strong>.</>
          ) : (
            <>Olá, {preview.invitedName.split(" ")[0]}! Defina sua senha para ativar o acesso a <strong>{preview.churchName}</strong>.</>
          )}
        </S.Text>

        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <S.Fields>
            <S.Field>
              <span>Nome completo</span>
              <S.ReadOnlyControl>
                <input value={preview.invitedName} readOnly aria-readonly="true" />
                <LockKeyhole size={16} />
              </S.ReadOnlyControl>
            </S.Field>
            <S.Field>
              <span>E-mail</span>
              <S.ReadOnlyControl>
                <input value={preview.email} readOnly aria-readonly="true" />
                <LockKeyhole size={16} />
              </S.ReadOnlyControl>
            </S.Field>
            <S.Field>
              <span>{passwordLabel}</span>
              <S.PasswordControl $invalid={Boolean(state.fieldErrors?.password)}>
                <input
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete={existingAccount ? "current-password" : "new-password"}
                  placeholder={existingAccount ? "Digite sua senha atual" : "Mínimo de 8 caracteres"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </S.PasswordControl>
              {state.fieldErrors?.password?.[0] ? <S.FieldError>{state.fieldErrors.password[0]}</S.FieldError> : null}
            </S.Field>
            <S.Field>
              <span>Confirmar {passwordLabel.toLowerCase()}</span>
              <S.PasswordControl $invalid={Boolean(state.fieldErrors?.passwordConfirmation)}>
                <input
                  name="passwordConfirmation"
                  type={confirmationVisible ? "text" : "password"}
                  autoComplete={existingAccount ? "current-password" : "new-password"}
                  placeholder="Digite novamente"
                  required
                />
                <button
                  type="button"
                  onClick={() => setConfirmationVisible((current) => !current)}
                  aria-label={confirmationVisible ? "Ocultar confirmação" : "Mostrar confirmação"}
                >
                  {confirmationVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </S.PasswordControl>
              {state.fieldErrors?.passwordConfirmation?.[0] ? <S.FieldError>{state.fieldErrors.passwordConfirmation[0]}</S.FieldError> : null}
            </S.Field>
          </S.Fields>

          <S.Details>
            <div><span>Papel de acesso</span><strong>{ROLE_LABELS[preview.role]}</strong></div>
            <div><span>Escopo</span><strong>{SCOPE_LABELS[preview.scope]}</strong></div>
          </S.Details>
          {state.status === "error" ? <S.Alert>{state.message}</S.Alert> : null}
          <S.PrimaryButton type="submit" disabled={pending}>
            {pending ? <S.Spinner /> : <ShieldCheck size={18} />}
            {pending
              ? "Ativando sua conta..."
              : existingAccount
                ? "Entrar e aceitar convite"
                : "Criar senha e acessar"}
          </S.PrimaryButton>
        </form>
        <S.Footnote>
          Nome e e-mail foram definidos pelo Administrador e não podem ser alterados. Este convite expira em {new Date(preview.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
        </S.Footnote>
      </S.Card>
    </S.Page>
  );
}
