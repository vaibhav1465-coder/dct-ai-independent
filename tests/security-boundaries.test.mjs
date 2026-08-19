import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("provider secrets remain server-only and frontend requests use same-origin API routes", async () => {
  const form = await readFile(new URL("../app/ui/check-form.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../app/ui/user-menu.tsx", import.meta.url), "utf8");
  for (const source of [form, menu]) {
    assert.doesNotMatch(source, /ANTHROPIC_API_KEY|COPYLEAKS_API_KEY|GOOGLE_CLIENT_SECRET/);
    assert.doesNotMatch(source, /api\.anthropic\.com|api\.copyleaks\.com|id\.copyleaks\.com/);
  }
  assert.match(form, /fetch\("\/api\/check"/);
  assert.match(menu, /"x-dct-csrf": "1"/);
});

test("mutating APIs enforce request security and rate limits", async () => {
  const check = await readFile(new URL("../app/api/check/route.ts", import.meta.url), "utf8");
  const rating = await readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8");
  const feedback = await readFile(new URL("../app/api/user-feedback/route.ts", import.meta.url), "utf8");
  const guard = await readFile(new URL("../lib/request-security.ts", import.meta.url), "utf8");
  for (const source of [check, rating, feedback]) assert.match(source, /rejectUnsafeMutation/);
  for (const source of [rating, feedback]) assert.match(source, /enforceActionLimit/);
  assert.match(guard, /sec-fetch-site/);
  assert.match(guard, /x-dct-csrf/);
  assert.match(guard, /content-length/);
});
