import { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
};

export function Select({
  label,
  helperText,
  error,
  options,
  placeholder = "Selecione uma opção",
  className,
  id,
  ...props
}: SelectProps) {
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

      <div className="relative">
        <select
          id={id}
          className={cn(
            "w-full appearance-none rounded-[6px] border border-transparent bg-[#f6f7f9] px-3 py-[17px] pr-10 font-['Manrope'] !text-[14px] !font-semibold !text-[#090f4d] outline-none transition",
            "focus:border-[#3956a6]/25 focus:bg-white focus:ring-4 focus:ring-[#3956a6]/[0.08]",
            error &&
              "border-[#F76464] bg-white focus:border-[#F76464] focus:ring-[#F76464]/10",
            className,
          )}
          {...props}
        >
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={17}
          strokeWidth={1.8}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

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
