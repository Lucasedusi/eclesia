import { ReactNode } from "react";
import { cn } from "@/utils/cn";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  darkHeader?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  className,
  darkHeader = false,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[14px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div
        className={cn(
          "px-6 py-5",
          darkHeader ? "bg-[#0A0F4D] text-white" : "bg-white",
        )}
      >
        <h2
          className={cn(
            "text-[18px] font-bold tracking-tight",
            darkHeader ? "text-white" : "text-[rgb(27,27,27)]",
          )}
        >
          {title}
        </h2>

        {description && (
          <p
            className={cn(
              "mt-1 text-[14px] font-medium leading-6",
              darkHeader ? "text-white/70" : "text-slate-500",
            )}
          >
            {description}
          </p>
        )}
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}
