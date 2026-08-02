"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { signUpAction } from "../actions/auth.actions";
import { INITIAL_ACTION_STATE } from "../types/auth.types";
import { AuthBrand } from "./auth-shell/auth-shell";
import { PasswordField } from "./password-field";
import * as S from "./auth-shell/auth-shell.styles";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    INITIAL_ACTION_STATE,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  return (
    <>
      <AuthBrand />
      <S.Eyebrow>Comece com segurança</S.Eyebrow>
      <S.Title>Crie a primeira conta</S.Title>
      <S.Description>
        Esta conta será o primeiro Administrador. Em seguida, você cadastrará a
        igreja e a Congregação Sede.
      </S.Description>

      <S.Form action={formAction} noValidate>
        {state.status !== "idle" ? (
          <S.Alert $success={state.status === "success"}>
            {state.message}
          </S.Alert>
        ) : null}
        <S.Field>
          <S.Label htmlFor="fullName">Nome completo</S.Label>
          <S.Input
            id="fullName"
            name="fullName"
            placeholder="Seu nome completo"
            autoComplete="name"
            $invalid={Boolean(state.fieldErrors?.fullName)}
            required
          />
          {state.fieldErrors?.fullName?.[0] ? (
            <S.FieldError>{state.fieldErrors.fullName[0]}</S.FieldError>
          ) : null}
        </S.Field>
        <S.Field>
          <S.Label htmlFor="email">E-mail</S.Label>
          <S.Input
            id="email"
            name="email"
            type="email"
            placeholder="voce@igreja.com.br"
            autoComplete="email"
            $invalid={Boolean(state.fieldErrors?.email)}
            required
          />
          {state.fieldErrors?.email?.[0] ? (
            <S.FieldError>{state.fieldErrors.email[0]}</S.FieldError>
          ) : null}
        </S.Field>
        <PasswordField
          name="password"
          label="Senha"
          autoComplete="new-password"
          error={state.fieldErrors?.password?.[0]}
        />
        <PasswordField
          name="passwordConfirmation"
          label="Confirmar senha"
          autoComplete="new-password"
          error={state.fieldErrors?.passwordConfirmation?.[0]}
        />
        <S.CheckRow>
          <input type="checkbox" name="acceptedTerms" />
          <span>
            Li e aceito os <a href="#">Termos de Uso</a> e a{" "}
            <a href="#">Política de Privacidade</a>.
          </span>
        </S.CheckRow>
        {state.fieldErrors?.acceptedTerms?.[0] ? (
          <S.FieldError>{state.fieldErrors.acceptedTerms[0]}</S.FieldError>
        ) : null}
        <S.Submit type="submit" disabled={pending}>
          {pending ? <S.Spinner /> : null}
          {pending ? "Criando conta..." : "Criar minha conta"}
        </S.Submit>
      </S.Form>
      <S.SwitchText>
        Já possui uma conta? <Link href="/login">Entrar no sistema</Link>
      </S.SwitchText>
      <S.SecurityNote>
        <LockKeyhole size={14} /> Sua senha nunca é armazenada pelo Eclesias.
      </S.SecurityNote>
    </>
  );
}
