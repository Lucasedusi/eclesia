"use client";

import type { SelectHTMLAttributes } from "react";
import {
  ErrorText,
  FieldLabel,
  FieldWrapper,
  SelectBox,
  SelectControl,
} from "./select.styles";

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
};

export function Select({
  id,
  label,
  error,
  options,
  placeholder = "Selecione uma opção",
  ...props
}: SelectProps) {
  return (
    <FieldWrapper>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}

      <SelectBox>
        <SelectControl id={id} $hasError={Boolean(error)} {...props}>
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectControl>
      </SelectBox>

      {error ? <ErrorText>{error}</ErrorText> : null}
    </FieldWrapper>
  );
}
