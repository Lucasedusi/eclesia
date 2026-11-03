"use client";
import { useRef, useState } from "react";
import { submitFinancePayableAction } from "../actions/finance-payable.actions";
import type { PayableResult } from "../types/finance-payable.types";

export function usePayableMutation(onSuccess: (result: PayableResult) => void) {
  const lock = useRef(false), pending = useRef<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [uncertain, setUncertain] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
  async function run(input: Record<string, unknown>) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError("");
    pending.current ??= { ...input, requestId: crypto.randomUUID() };
    try {
      const result = await submitFinancePayableAction(pending.current);
      if (!result.ok) {
        setError(result.message);
        const unknown = result.code === "UNAVAILABLE";
        setUncertain(unknown);
        setNeedsRefresh((previous) => previous || unknown || result.code === "CONFLICT");
        if (!unknown) pending.current = null;
        return false;
      }
      pending.current = null; setUncertain(false); onSuccess(result.data); return true;
    } catch {
      setUncertain(true); setNeedsRefresh(true);
      setError("A conexão foi interrompida. Tente novamente para conferir a mesma operação, sem duplicá-la.");
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  return { run, busy, error, uncertain, needsRefresh };
}
