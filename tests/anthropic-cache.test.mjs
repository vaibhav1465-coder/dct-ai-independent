import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Anthropic system prompt uses one cache breakpoint", async () => {
  const source = await readFile(new URL("../lib/anthropic.ts", import.meta.url), "utf8");
  assert.match(source, /index === knowledgeBlocks\.length - 1/);
  assert.equal(source.match(/cache_control/g)?.length, 1);
});
