const DEFAULT_REDIRECT = "/";

export function getSafeRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = DEFAULT_REDIRECT,
) {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("\0")
  ) {
    return fallback;
  }

  return candidate;
}
