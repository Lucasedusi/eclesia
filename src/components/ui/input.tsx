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
          "w-full rounded-[6px] border border-transparent bg-[#f6f7f9] px-3 py-[17px] !text-[14px] !font-semibold !text-[#090f4d] outline-none transition",
          "placeholder:text-slate-300",
          "focus:border-[#3956a6]/25 focus:bg-white focus:ring-4 focus:ring-[#3956a6]/[0.08]",
          error &&
            "border-[#F76464] bg-white focus:border-[#F76464] focus:ring-[#F76464]/10",
          className,
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-[#F76464]">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
