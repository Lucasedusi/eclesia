"use client";
import {
  useState,
  useRef,
  useLayoutEffect,
  type InputHTMLAttributes,
} from "react";
import {
  formatCurrencyInput,
  maskCurrencyInput,
} from "../utils/finance-money-mask";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  signed?: boolean;
};
export function FinanceMoneyInput({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  signed = false,
  ...props
}: Props) {
  const [draft, setDraft] = useState(() =>
    defaultValue === undefined
      ? ""
      : formatCurrencyInput(String(defaultValue), signed),
  );
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const displayed =
    value === undefined
      ? draft
      : focused
        ? maskCurrencyInput(String(value), signed)
        : formatCurrencyInput(String(value), signed);
  useLayoutEffect(() => {
    if (caret.current !== null && input.current === document.activeElement)
      input.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  return (
    <span className="finance-money-field">
      <span aria-hidden="true" />
      <input
        {...props}
        ref={input}
        type="text"
        inputMode="decimal"
        value={displayed}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          const count = raw
            .slice(0, e.currentTarget.selectionStart ?? raw.length)
            .replace(/[^\d,-]/g, "").length;
          const next = maskCurrencyInput(raw, signed);
          let position = 0,
            seen = 0;
          while (position < next.length && seen < count) {
            if (/[\d,-]/.test(next[position])) seen++;
            position++;
          }
          caret.current = position;
          e.currentTarget.value = next;
          setDraft(next);
          onChange?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          const next = formatCurrencyInput(e.currentTarget.value, signed);
          e.currentTarget.value = next;
          setDraft(next);
          // Native form submission reads the formatted input; controlled consumers retain their decimal draft.
          onBlur?.(e);
        }}
      />
    </span>
  );
}
