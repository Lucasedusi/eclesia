export function planFinancePwaUpdate({
  waiting,
  alreadyActivated,
  dirty,
}: {
  waiting: boolean;
  alreadyActivated: boolean;
  dirty: boolean;
}): "BLOCKED" | "ACTIVATE" | "RELOAD" | "NONE" {
  if (dirty) return "BLOCKED";
  if (alreadyActivated) return "RELOAD";
  if (waiting) return "ACTIVATE";
  return "NONE";
}
