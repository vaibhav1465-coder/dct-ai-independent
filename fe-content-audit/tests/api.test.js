import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import authHandler from "../api/auth.js";
import { verifyToken } from "../api/_verifyToken.js";
import { validateAnalysisResult } from "../api/analyze.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test("authentication rejects an incorrect password and issues a verifiable token for the correct password", async () => {
  const previous = { password: process.env.APP_PASSWORD, secret: process.env.SESSION_SECRET };
  process.env.APP_PASSWORD = "correct-password";
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  try {
    const rejected = responseRecorder();
    await authHandler({ method: "POST", body: { password: "incorrect" } }, rejected);
    assert.equal(rejected.statusCode, 401);
    assert.equal(rejected.body.error, "Incorrect password.");

    const accepted = responseRecorder();
    await authHandler({ method: "POST", body: { password: "correct-password" } }, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.equal(verifyToken(`Bearer ${accepted.body.token}`).valid, true);
    assert.ok(accepted.body.expiresAt > Date.now());
  } finally {
    if (previous.password === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = previous.password;
    if (previous.secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.secret;
  }
});

test("token verification rejects missing, malformed, and expired credentials", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-secret";
  try {
    assert.equal(verifyToken(undefined).valid, false);
    assert.equal(verifyToken("Bearer malformed").valid, false);
    const expiresAt = Date.now() - 1;
    const signature = crypto.createHmac("sha256", "test-secret").update(String(expiresAt)).digest("hex");
    assert.equal(verifyToken(`Bearer ${expiresAt}.${signature}`).reason, "Session expired. Log in again.");
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous;
  }
});

test("analysis validation accepts grounded recommendations and rejects invented evidence", () => {
  const article = { headline: "Rates remain unchanged", body_text: "The central bank kept the policy rate unchanged after its meeting." };
  const result = {
    page_classification: "Overhaul",
    action_tag: "IMPROVE",
    tier: "T1",
    data_availability: "SUMMARY",
    confidence: "medium",
    executive_summary: "This page reports the rate decision but does not help readers understand what it means or what to watch next.",
    editorial_flag: "NONE",
    findings: [
      {
        area: "Helpfulness",
        issue: "Thin explanation of reader impact",
        evidence: "kept the policy rate unchanged",
        impact: "Readers do not learn what the policy decision means for borrowers, savers, or markets.",
        fix: "Add a short section explaining the practical effect on EMIs, deposits, and market sentiment.",
      },
      {
        area: "Trust",
        issue: "Primary source not visible in supplied copy",
        evidence: "policy rate unchanged after its meeting",
        impact: "Trust is weaker when the article does not visibly point readers to the source decision or expert context.",
        fix: "Cite the central bank statement or add one named expert comment to ground the update.",
      },
    ],
    next_steps: [
      "Add the central bank source document.",
      "Explain the borrower and saver impact.",
    ],
  };
  assert.equal(validateAnalysisResult(result, article), true);
  assert.equal(validateAnalysisResult({
    ...result,
    findings: [{ ...result.findings[0], evidence: "invented quotation" }, result.findings[1]],
  }, article), false);
});
