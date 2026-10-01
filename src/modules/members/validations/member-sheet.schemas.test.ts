import { describe, expect, it } from "vitest";
import { memberSheetOptionsSchema } from "./member-sheet.schemas";

describe("memberSheetOptionsSchema", () => {
  it("emite somente cadastro por padrão", () => {
    expect(memberSheetOptionsSchema.parse({})).toEqual({ includeHistory: false, includeEvents: false });
  });

  it("aceita a combinação das duas seções opcionais", () => {
    expect(memberSheetOptionsSchema.parse({ includeHistory: true, includeEvents: true }))
      .toEqual({ includeHistory: true, includeEvents: true });
  });

  it.each([{ includeHistory: "true" }, { includeFinance: true }, { churchId: "other" }, { includeSensitive: true }])(
    "recusa opções não autorizadas: %j", (input) => {
      expect(memberSheetOptionsSchema.safeParse(input).success).toBe(false);
    },
  );
});
