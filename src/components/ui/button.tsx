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
    "border-none bg-[#3956a6] text-white shadow-[0_8px_24px_var(--tw-shadow-color,#0060d10f)] hover:bg-[#2f478b] hover:shadow-[0_10px_26px_rgba(57,86,166,0.16)]",
  secondary:
    "border-none bg-[#f6f7f9] text-[#090f4d] hover:bg-[#eef2ff] hover:text-[#3956a6]",
  ghost:
    "border-none bg-transparent text-slate-600 hover:bg-[#f6f7f9] hover:text-[#3956a6]",
  danger:
    "border-none bg-[#F76464] text-white hover:bg-[rgb(235,85,80)] hover:shadow-[0_10px_26px_rgba(247,100,100,0.18)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-3 text-[13px]",
  md: "min-h-[50px] px-6 py-4 text-[14px]",
  lg: "min-h-[52px] px-7 py-4 text-[14px]",
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
        "inline-flex items-center justify-center gap-[15px] rounded-[6px] !text-[13px] !font-semibold transition disabled:pointer-events-none disabled:opacity-60",
        "cursor-pointer active:translate-y-px",
        "[&_svg]:h-[17px] [&_svg]:w-[18px] [&_svg]:stroke-[1.8]",
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
