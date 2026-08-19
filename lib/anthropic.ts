import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { loadKnowledge } from "./knowledge";
import { outputErrors } from "./validation";

export const DCT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

function textFrom(message: Anthropic.Message) {
  return message.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("\n");
}

export async function runEditorialCheck(input: { publication: string; headline: string; subhead: string; article: string }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("PROVIDER_NOT_CONFIGURED");
  const knowledge = await loadKnowledge();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  const knowledgeBlocks = [knowledge.master, ...knowledge.active];
  const system: Anthropic.TextBlockParam[] = knowledgeBlocks.map((text, index) => ({
    type: "text",
    text,
    ...(index === knowledgeBlocks.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
  const submission = `CURRENT DATE\n17 August 2026\n\nDATE RULE\nDo not flag a 2026 dateline or 2026 reference as future-dated unless the article clearly refers to a date after 17 August 2026.\n\nPUBLICATION\n${input.publication}\n\nSUGGESTED HEADLINE\n${input.headline}\n\nSUGGESTED SUBHEAD / STRAP / EXCERPT\n${input.subhead || "[No suggested subhead supplied]"}\n\nARTICLE COPY\n${input.article}`;
  const first = await client.messages.create({ model: DCT_MODEL, max_tokens: 8_000, system, messages: [{ role: "user", content: submission }] });
  let content = textFrom(first);
  let repaired = false;
  const errors = outputErrors(content);
  if (errors.length) {
    const repair = await client.messages.create({ model: DCT_MODEL, max_tokens: 8_000, system, messages: [{ role: "user", content: submission }, { role: "assistant", content }, { role: "user", content: `FORMAT REPAIR ONLY. Preserve the editorial judgement, verdict, evidence and coaching conclusions exactly. Return the entire response in the mandated format and correct only these validation failures:\n- ${errors.join("\n- ")}` }] });
    content = textFrom(repair);
    repaired = true;
    const remaining = outputErrors(content);
    if (remaining.length) throw new Error(`OUTPUT_INVALID:${remaining.join("|")}`);
    return { content, usage: { input: first.usage.input_tokens + repair.usage.input_tokens, output: first.usage.output_tokens + repair.usage.output_tokens }, repaired };
  }
  return { content, usage: { input: first.usage.input_tokens, output: first.usage.output_tokens }, repaired };
}
