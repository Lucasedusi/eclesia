"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import * as S from "./auth-shell/auth-shell.styles";

type PasswordFieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  labelAction?: React.ReactNode;
};

export function PasswordField({
  name,
  label,
  placeholder = "Digite sua senha",
  error,
  autoComplete = "current-password",
  labelAction,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <S.Field>
      <S.FieldTop>
        <S.Label htmlFor={name}>{label}</S.Label>
        {labelAction}
      </S.FieldTop>
      <S.InputWrap>
        <S.Input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          $invalid={Boolean(error)}
          required
        />
        <S.PasswordButton
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </S.PasswordButton>
      </S.InputWrap>
      {error ? <S.FieldError id={`${name}-error`}>{error}</S.FieldError> : null}
    </S.Field>
  );
}
