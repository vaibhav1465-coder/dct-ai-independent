import { z } from "zod";

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

export const checkSchema = z.object({
  publication: z.enum(["Indian Express", "Financial Express", "Jansatta", "Loksatta"]),
  headline: z.string().min(1, "Suggested headline is required.").max(240).transform(clean),
  subhead: z.string().max(280).transform(clean).default(""),
  article: z.string().min(255, "Article copy must contain at least 255 characters for AI detection.").max(50_000).transform(clean),
}).strict();

export type CheckInput = z.infer<typeof checkSchema>;

export function validateCheck(value: unknown): { ok: true; data: CheckInput } | { ok: false; error: string } {
  const result = checkSchema.safeParse(value);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: result.error.issues[0]?.message ?? "Invalid request." };
}

const mandatorySections = ["EDITORIAL CHECK", "VERDICT:", "HEADLINE AUDIT", "PRIMARY COACHING NOTE", "COPYEDITING FLAGS", "REPAIR SEQUENCE", "HEADLINE OPTIONS", "ONE THING TO FIX FIRST", "WHAT THIS STORY DOES WELL"];

export function outputErrors(text: string) {
  const errors = mandatorySections.filter((section) => !text.includes(section)).map((section) => `Missing ${section}`);
  if (!/Paragraph\s+\d+/i.test(text)) errors.push("Primary coaching note lacks a paragraph reference");
  const options = ["Hard news:", "Context-led:", "Reader hook:"];
  if (options.filter((item) => text.includes(item)).length !== 3) errors.push("Exactly three labelled headline options are required");
  const fix = text.split("ONE THING TO FIX FIRST")[1]?.split(/\n[-━]{5,}|\nWHAT THIS STORY/i)[0]?.trim();
  if (!fix || fix.split(/[.!?](?:\s|$)/).filter(Boolean).length > 1) errors.push("ONE THING TO FIX FIRST must be one sentence");
  return errors;
}

export function outputSummary(text: string) {
  const verdict = text.match(/VERDICT:\s*([^\n]+)/i)?.[1]?.trim() ?? "Editorial review complete";
  const category = text.match(/PRIMARY:\s*([^\n—-]+)/i)?.[1]?.trim() ?? "Editorial coaching";
  return { verdict, category };
}
