import { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export function Input({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-[13px] font-semibold tracking-[-0.005em] text-[#3A3A39]"
        >
          {label}
        </label>
      )}

      <input
        id={id}
        className={cn(
          "w-full rounded-[10px] border-[1.5px] bg-white px-4 py-[13px] font-['Manrope'] text-[14px] font-medium text-slate-800 outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-[#3956a6] focus:ring-4 focus:ring-[#3956a6]/10",
          error ? "border-[rgb(255,114,109)]" : "border-[#cfcec9]",
          className,
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-[rgb(255,114,109)]">
          {error}
        </p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
