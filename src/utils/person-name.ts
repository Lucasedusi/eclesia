// Presentation only. Registered spelling is never rewritten in storage.
export function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toUpperCase() || "US";
}

export function formatPersonName(value: string): string {
  if (!value || value === "Não informado" || /^[=+@]/.test(value)) return value;
  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);
  return value
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (i > 0 && particles.has(lower)) return lower;
      if (/^(?:II|III|IV|VI|VII|VIII|IX)$/.test(word)) return word;
      return lower.replace(
        /(^|[-'’])(\p{L})/gu,
        (_, prefix: string, letter: string) =>
          prefix + letter.toLocaleUpperCase("pt-BR"),
      );
    })
    .join(" ");
}
