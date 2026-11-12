"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, updatePasswordAction } from "../actions/auth.actions";
import { INITIAL_ACTION_STATE } from "../types/auth.types";
import { AuthFormCard } from "./auth-shell/auth-shell";
import { PasswordField } from "./password-field";
import * as S from "./auth-shell/auth-shell.styles";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL_ACTION_STATE);
  return (
    <AuthFormCard>
      <S.Title>Esqueceu a senha?</S.Title>
      <S.Description>Informe seu e-mail para solicitar um link de recuperação.</S.Description>
      <S.Form action={action} noValidate>
        {state.status !== "idle" && <S.Alert role="status" $success={state.status === "success"}>{state.message}</S.Alert>}
        <S.Field>
          <S.Label htmlFor="recovery-email">E-mail</S.Label>
          <S.Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@igreja.com.br"
            $invalid={Boolean(state.fieldErrors?.email)}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "recovery-email-error" : undefined}
            required
          />
          {state.fieldErrors?.email?.[0] && <S.FieldError id="recovery-email-error">{state.fieldErrors.email[0]}</S.FieldError>}
        </S.Field>
        <S.Submit disabled={pending}>
          {pending && <S.Spinner />}{pending ? "Enviando..." : "Enviar instruções"}
        </S.Submit>
      </S.Form>
      <S.SwitchText><Link href="/login">Voltar para o login</Link></S.SwitchText>
    </AuthFormCard>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, INITIAL_ACTION_STATE);
  return (
    <AuthFormCard>
      <S.Title>Defina uma nova senha</S.Title>
      <S.Description>Use ao menos 8 caracteres, incluindo letras e números.</S.Description>
      <S.Form action={action} noValidate>
        {state.status === "error" && <S.Alert role="alert">{state.message}</S.Alert>}
        <PasswordField name="password" label="Nova senha" autoComplete="new-password" error={state.fieldErrors?.password?.[0]} />
        <PasswordField name="passwordConfirmation" label="Confirmar nova senha" autoComplete="new-password" error={state.fieldErrors?.passwordConfirmation?.[0]} />
        <S.Submit disabled={pending}>
          {pending && <S.Spinner />}{pending ? "Salvando..." : "Salvar nova senha"}
        </S.Submit>
      </S.Form>
    </AuthFormCard>
  );
}
