import { describe, expect, it } from "vitest";
import {
  documentContainerActionSchema,
  documentLifecycleSchema,
} from "./document.schemas";

const DOCUMENT_ID = "2d54a9a1-76ed-4d39-a954-92f1c79810af";

describe("document container lifecycle validation", () => {
  it("accepts permanent deletion for a category or folder in the trash", () => {
    const result = documentContainerActionSchema.safeParse({
      id: DOCUMENT_ID,
      action: "DELETE_PERMANENTLY",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported container actions", () => {
    const result = documentContainerActionSchema.safeParse({
      id: DOCUMENT_ID,
      action: "PURGE_WITHOUT_CONFIRMATION",
    });

    expect(result.success).toBe(false);
  });

  it("keeps permanent document deletion available", () => {
    const result = documentLifecycleSchema.safeParse({
      id: DOCUMENT_ID,
      action: "DELETE_PERMANENTLY",
    });

    expect(result.success).toBe(true);
  });
});
