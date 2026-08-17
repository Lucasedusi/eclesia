import { describe, expect, it } from "vitest";
import { cacheTags } from "./cache-tags";

describe("cacheTags", () => {
  it("mantém uma chave global para a disponibilidade do cadastro inicial", () => {
    expect(cacheTags.initialRegistration).toBe("initial-registration");
  });

  it("sempre inclui a igreja na chave de cache", () => {
    const churchId = "2c27a632-487a-4e56-a588-cb34b0bd19e4";
    expect(cacheTags.organization(churchId)).toBe(`organization:${churchId}`);
    expect(cacheTags.memberFilters(churchId)).toBe(`member-filters:${churchId}`);
    expect(cacheTags.documentReferences(churchId)).toBe(`document-references:${churchId}`);
  });
});
