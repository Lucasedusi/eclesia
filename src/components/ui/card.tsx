import { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({
  className,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
        padded && "p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  dark = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        dark
          ? "-mx-6 -mt-6 mb-6 rounded-t-[14px] bg-[#0A0F4D] px-6 py-5 text-white"
          : "mb-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-[18px] font-bold tracking-tight text-[rgb(27,27,27)]",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-1 text-[14px] font-medium leading-6 text-slate-500",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex w-full flex-col gap-5", className)} {...props}>
      {children}
    </div>
  );
}
