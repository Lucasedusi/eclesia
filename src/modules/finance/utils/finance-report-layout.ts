/** Wrap without truncation, including long references and explicit paragraphs. */
export function wrapReportText(
  text: string,
  width: number,
  measure: (value: string) => number,
): string[] {
  const lines: string[] = [];
  const clean = text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  for (const paragraph of clean.split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const letter of word) {
        if (line && measure(line + letter) > width) {
          lines.push(line);
          line = "";
        }
        line += letter;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}
