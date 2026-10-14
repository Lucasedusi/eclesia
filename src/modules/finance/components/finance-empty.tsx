import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
export function FinanceEmpty({ children }: { children: ReactNode }) {
  return <div className="empty"><Inbox size={30} strokeWidth={1.4} aria-hidden="true" /><div>{children}</div></div>;
}
