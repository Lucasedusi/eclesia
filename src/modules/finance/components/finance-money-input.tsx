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
  formatPastedCurrency,
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
  onPaste,
  onKeyDown,
  signed = false,
  ...props
}: Props) {
  const [draft, setDraft] = useState(() =>
    defaultValue === undefined
      ? ""
      : formatCurrencyInput(String(defaultValue), signed),
  );
  const pasted = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const displayed =
    value === undefined
      ? draft
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
          onFocus?.(e);
        }}
        onPaste={(e) => {
          onPaste?.(e);
          if (!e.defaultPrevented) pasted.current = e.clipboardData.getData("text");
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          const field = e.currentTarget;
          const pos = field.selectionStart ?? 0;
          if (field.selectionEnd !== pos) return;
          // Delete a digit along with an adjacent formatting separator.
          if (e.key === "Backspace" && /[.,]/.test(field.value[pos - 1] ?? ""))
            field.setSelectionRange(Math.max(0, pos - 2), pos);
          if (e.key === "Delete" && /[.,]/.test(field.value[pos] ?? ""))
            field.setSelectionRange(pos, pos + 2);
        }}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          const rightDigits = raw
            .slice(e.currentTarget.selectionStart ?? raw.length)
            .replace(/\D/g, "").length;
          const next = pasted.current !== null
            ? formatPastedCurrency(raw, signed)
            : maskCurrencyInput(raw, signed);
          pasted.current = null;
          let position = next.length, seen = 0;
          while (position > 0 && seen < rightDigits) {
            position--;
            if (/\d/.test(next[position])) seen++;
          }
          caret.current = position;
          e.currentTarget.value = next;
          setDraft(next);
          onChange?.(e);
        }}
        onBlur={(e) => {
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
