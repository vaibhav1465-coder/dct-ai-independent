import { describe, expect, it } from "vitest";
import { outputErrors, validateCheck } from "../lib/validation";
describe("check validation", () => {
  it("accepts bounded newsroom copy", () => expect(validateCheck({ publication: "Indian Express", headline: "A headline", article: "word ".repeat(20) }).ok).toBe(true));
  it("rejects unsupported publication", () => expect(validateCheck({ publication: "Other", headline: "", article: "word ".repeat(20) }).ok).toBe(false));
  it("requires all mandatory output sections", () => expect(outputErrors("incomplete response").length).toBeGreaterThan(1));
});
