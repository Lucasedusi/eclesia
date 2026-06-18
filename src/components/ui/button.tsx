import { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-none bg-[#3956a6] text-white hover:bg-[#2f478b] hover:shadow-[0_8px_18px_rgba(57,86,166,0.18)]",
  secondary:
    "border border-[#cfcec9] bg-white text-slate-800 hover:border-[#3956a6] hover:bg-[#eef2ff] hover:text-[#3956a6]",
  ghost:
    "border-none bg-transparent text-slate-600 hover:bg-[#eef2ff] hover:text-[#3956a6]",
  danger:
    "border-none bg-[rgb(255,114,109)] text-white hover:bg-[rgb(235,85,80)] hover:shadow-[0_8px_18px_rgba(255,114,109,0.2)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-[13px]",
  md: "h-12 px-4 text-[14px]",
  lg: "h-12 px-5 text-[14px]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition disabled:pointer-events-none disabled:opacity-60",
        "cursor-pointer active:translate-y-px",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
