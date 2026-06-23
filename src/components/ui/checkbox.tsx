"use client";

import { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import * as S from "./checkbox.styles";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

export function Checkbox({ label, id, ...props }: CheckboxProps) {
  const checkboxId = id ?? props.name;

  return (
    <S.CheckboxLabel htmlFor={checkboxId}>
      <S.CheckboxFrame>
        <S.HiddenCheckbox id={checkboxId} type="checkbox" {...props} />
        <S.CheckboxControl aria-hidden="true">
          <Check />
        </S.CheckboxControl>
      </S.CheckboxFrame>
      {label && <S.CheckboxText>{label}</S.CheckboxText>}
    </S.CheckboxLabel>
  );
}
