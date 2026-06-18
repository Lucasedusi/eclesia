import { TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  helperText?: string;
  error?: string;
};

export function Textarea({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}: TextareaProps) {
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

      <textarea
        id={id}
        className={cn(
          "min-h-[120px] w-full resize-y rounded-[6px] border border-gray-100 bg-[#f6f7f9] px-3 py-[17px] font-['Manrope'] !text-[13px] !font-semibold !text-[#090f4d] outline-none transition",
          "placeholder:text-slate-400",
          "focus:border-[#3956a6]/25 focus:bg-white focus:ring-3 focus:ring-[#3956a6]/[0.08]",
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
