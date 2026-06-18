import { ReactNode } from "react";
import { cn } from "@/utils/cn";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div>
        <h1 className="text-[18px] font-bold tracking-tight text-slate-950">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-1 text-[14px] font-medium leading-6 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}
