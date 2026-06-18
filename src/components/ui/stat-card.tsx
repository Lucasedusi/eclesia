import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  variation?: string;
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variation,
  className,
}: StatCardProps) {
  return (
    <article
      className={cn(
        "rounded-[14px] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-slate-500">{title}</p>

          <h3 className="mt-3 text-[18px] font-bold tracking-tight text-[rgb(27,27,27)]">
            {value}
          </h3>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#eef2ff] text-[#3956a6]">
          <Icon size={21} />
        </div>
      </div>

      {(description || variation) && (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7e5df] pt-4">
          {description && (
            <p className="text-xs font-medium text-slate-500">{description}</p>
          )}

          {variation && (
            <span className="rounded-[10px] bg-[#f6f7f9] px-2.5 py-1 text-xs font-semibold text-slate-500">
              {variation}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
