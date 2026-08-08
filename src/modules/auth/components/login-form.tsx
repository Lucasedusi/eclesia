"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
import { loginAction } from "../actions/auth.actions";
import { INITIAL_ACTION_STATE } from "../types/auth.types";
import { AuthBrand } from "./auth-shell/auth-shell";
import { PasswordField } from "./password-field";
import * as S from "./auth-shell/auth-shell.styles";

type LoginFormProps = {
  next?: string;
  linkError?: boolean;
  canCreateInitialAccount: boolean;
  registrationStatus?: "closed" | "unavailable";
};

export function LoginForm({
  next,
  linkError,
  canCreateInitialAccount,
  registrationStatus,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_ACTION_STATE,
  );
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      startNavigation();
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, startNavigation, state]);

  return (
    <>
      <AuthBrand />
      <S.Eyebrow>Paz do Senhor, seja bem-vindo!</S.Eyebrow>
      <S.Title>Acesse sua conta</S.Title>
      <S.Description>
        Informe seus dados para entrar no ambiente administrativo.
      </S.Description>

      <S.Form action={formAction} noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        {linkError ? (
          <S.Alert>Este link é inválido ou expirou. Entre novamente ou solicite um novo link.</S.Alert>
        ) : null}
        {registrationStatus === "closed" ? (
          <S.Alert>
            O cadastro inicial já foi concluído. Novos usuários devem entrar por
            convite do Administrador.
          </S.Alert>
        ) : null}
        {registrationStatus === "unavailable" ? (
          <S.Alert>
            O cadastro inicial está temporariamente indisponível. Verifique a
            configuração do servidor.
          </S.Alert>
        ) : null}
        {state.status === "error" ? <S.Alert>{state.message}</S.Alert> : null}

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
          {state.fieldErrors?.email?.[0] ? <S.FieldError>{state.fieldErrors.email[0]}</S.FieldError> : null}
        </S.Field>

        <PasswordField
          name="password"
          label="Senha"
          error={state.fieldErrors?.password?.[0]}
          labelAction={<S.FieldLink as={Link} href="/recuperar-senha">Esqueci minha senha</S.FieldLink>}
        />

        <S.Submit type="submit" disabled={pending}>
          {pending ? <S.Spinner /> : null}
          {pending ? "Entrando..." : "Entrar no sistema"}
        </S.Submit>
      </S.Form>

      {canCreateInitialAccount ? (
        <S.SwitchText>
          Primeiro acesso ao Eclésias? <Link href="/cadastro">Criar primeira conta</Link>
        </S.SwitchText>
      ) : (
        <S.SwitchText>
          Novos acessos são liberados por convite do Administrador.
        </S.SwitchText>
      )}
      <S.SecurityNote><LockKeyhole size={14} /> Seus dados são protegidos por uma conexão segura.</S.SecurityNote>
    </>
  );
}
