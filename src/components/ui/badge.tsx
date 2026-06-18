import { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  primary: "bg-[#eef2ff] text-[#3956a6]",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-[rgb(255,114,109)]/10 text-[rgb(235,85,80)]",
  neutral: "bg-slate-100 text-slate-600",
};

export function Badge({
  className,
  variant = "primary",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[26px] items-center justify-center rounded-[10px] px-3 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
