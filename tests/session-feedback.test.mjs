import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("feedback copy and active-session persistence are present", async () => {
  const source = await readFile(new URL("../app/ui/check-form.tsx", import.meta.url), "utf8");
  assert.match(source, /Paste the draft copy here/);
  assert.match(source, /Suggested Headline/);
  assert.match(source, /Subhead \/ Straps \/ Excerpt \(Optional\)/);
  assert.match(source, /localStorage/);
  assert.match(source, /ACTIVE SESSION HISTORY/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /getDraftLabel/);
  assert.match(source, /Start new draft/);
  assert.match(source, /Share/);
  assert.doesNotMatch(source, /Untitled draft/);
  assert.doesNotMatch(source, /Privacy by design/);
  assert.doesNotMatch(source, /View or download a result here/);
  assert.match(source, /item\.result\.content/);
});

test("requested header credit is present", async () => {
  const source = await readFile(new URL("../app/ui/header.tsx", import.meta.url), "utf8");
  assert.match(source, /Editorial framework by Andrea McCarren/);
});
