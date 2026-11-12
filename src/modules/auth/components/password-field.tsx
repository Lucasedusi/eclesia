"use client";

import { useId, useState } from "react";
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
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <S.Field>
      <S.FieldTop>
        <S.Label htmlFor={id}>{label}</S.Label>
        {labelAction}
      </S.FieldTop>
      <S.InputWrap>
        <S.Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
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
      {error ? <S.FieldError id={`${id}-error`}>{error}</S.FieldError> : null}
    </S.Field>
  );
}
