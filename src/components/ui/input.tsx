"use client";

import type { InputHTMLAttributes } from "react";
import {
  ErrorText,
  FieldLabel,
  FieldWrapper,
  InputControl,
} from "./input.styles";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ id, label, error, ...props }: InputProps) {
  return (
    <FieldWrapper>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}

      <InputControl id={id} $hasError={Boolean(error)} {...props} />

      {error ? <ErrorText>{error}</ErrorText> : null}
    </FieldWrapper>
  );
}
