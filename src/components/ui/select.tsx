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
            "w-full appearance-none rounded-[10px] border-[1.5px] bg-white px-4 py-[13px] pr-10 font-['Manrope'] text-[14px] font-medium text-slate-800 outline-none transition",
            "focus:border-[#3956a6] focus:ring-4 focus:ring-[#3956a6]/10",
            error ? "border-[rgb(255,114,109)]" : "border-[#cfcec9]",
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
          size={18}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

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
