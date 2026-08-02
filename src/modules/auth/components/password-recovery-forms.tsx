"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgotPasswordAction, updatePasswordAction } from "../actions/auth.actions";
import { INITIAL_ACTION_STATE } from "../types/auth.types";
import { AuthBrand } from "./auth-shell/auth-shell";
import { PasswordField } from "./password-field";
import * as S from "./auth-shell/auth-shell.styles";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL_ACTION_STATE);
  return <>
    <AuthBrand /><S.Eyebrow>Recupere seu acesso</S.Eyebrow><S.Title>Esqueceu a senha?</S.Title>
    <S.Description>Informe seu e-mail. Se houver uma conta cadastrada, enviaremos um link seguro.</S.Description>
    <S.Form action={action} noValidate>
      {state.status !== "idle" ? <S.Alert $success={state.status === "success"}>{state.message}</S.Alert> : null}
      <S.Field><S.Label htmlFor="email">E-mail</S.Label><S.Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@igreja.com.br" $invalid={Boolean(state.fieldErrors?.email)} required />
      {state.fieldErrors?.email?.[0] ? <S.FieldError>{state.fieldErrors.email[0]}</S.FieldError> : null}</S.Field>
      <S.Submit disabled={pending}>{pending ? <S.Spinner /> : null}{pending ? "Enviando..." : "Enviar instruções"}</S.Submit>
    </S.Form>
    <S.SwitchText><Link href="/login">Voltar para o login</Link></S.SwitchText>
  </>;
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, INITIAL_ACTION_STATE);
  const router = useRouter();
  useEffect(() => { if (state.status === "success" && state.redirectTo) { router.replace(state.redirectTo); router.refresh(); } }, [router, state]);
  return <>
    <AuthBrand /><S.Eyebrow>Última etapa</S.Eyebrow><S.Title>Defina uma nova senha</S.Title>
    <S.Description>Use ao menos 8 caracteres, incluindo letras e números.</S.Description>
    <S.Form action={action} noValidate>
      {state.status !== "idle" ? <S.Alert $success={state.status === "success"}>{state.message}</S.Alert> : null}
      <PasswordField name="password" label="Nova senha" autoComplete="new-password" error={state.fieldErrors?.password?.[0]} />
      <PasswordField name="passwordConfirmation" label="Confirmar nova senha" autoComplete="new-password" error={state.fieldErrors?.passwordConfirmation?.[0]} />
      <S.Submit disabled={pending}>{pending ? <S.Spinner /> : null}{pending ? "Salvando..." : "Salvar nova senha"}</S.Submit>
    </S.Form>
  </>;
}
