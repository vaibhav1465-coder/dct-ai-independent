import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { verifyToken } from "./_verifyToken.js";

const SYSTEM_PROMPT_V2 = `You are the FE Content Audit recommendation engine for Financial Express.

Your job is to review one FE article package and return a grounded, usable editorial recommendation for SEO and editorial teams.

Rules:
- Use only the article package provided in the request.
- Do not browse the web.
- Do not invent facts, quotes, credentials, statistics, or source links.
- If information is unavailable, say it is unavailable.
- Prefer clear editorial recommendations over rigid audit jargon.
- Keep the output practical, simple, short, and directly usable by an SEO lead or editor.
- If a byline string is present, do not call the byline broken, missing, or malformed only because spacing, slug formatting, or display style looks compact. Treat it as a present byline unless the author field is actually empty.

What to evaluate:
1. Content usefulness and originality
2. Trust, sourcing, and byline quality
3. Thin / scaled / low-value risk
4. The best editorial action for this page

Choose exactly one action tag:
- KEEP
- IMPROVE
- DE-INDEX
- REDIRECT

Return valid JSON only in this exact shape:
{
  "tier": "T1" | "T2" | "T3",
  "data_availability": "FULL" | "SUMMARY" | "METADATA ONLY",
  "action_tag": "KEEP" | "IMPROVE" | "DE-INDEX" | "REDIRECT",
  "confidence": "high" | "medium" | "low",
  "executive_summary": "1-2 sentence summary in simple language",
  "editorial_flag": "short note or NONE",
  "findings": [
    {
      "area": "Helpfulness" | "Trust" | "Spam Risk",
      "issue": "short issue label",
      "evidence": "grounded evidence from supplied article or 'Unavailable from supplied article'",
      "impact": "why this matters",
      "fix": "clear editorial fix"
    }
  ],
  "next_steps": [
    "clear step 1",
    "clear step 2"
  ]
}`;

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const DAILY_BUDGET_CAP = Number(process.env.DAILY_REQUEST_CAP || 500);
const PER_MINUTE_LIMIT = Number(process.env.PER_MINUTE_LIMIT_PER_IP || 15);
const MAX_BODY_TEXT_CHARS = Number(process.env.MAX_BODY_TEXT_CHARS || 7000);
const MAX_ARTICLE_PAYLOAD_CHARS = Number(process.env.MAX_ARTICLE_PAYLOAD_CHARS || 12000);
const DEFAULT_STANDARD_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const DEFAULT_LOW_COST_MODEL = process.env.ANTHROPIC_LOW_COST_MODEL || "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_STANDARD_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";
const DEFAULT_OPENAI_LOW_COST_MODEL = process.env.OPENAI_LOW_COST_MODEL || "gpt-5.6-luna";

function stripToPlainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\r/g, "").replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function fingerprintKey(apiKey) {
  if (!apiKey) return "missing";
  return createHash("sha256").update(String(apiKey)).digest("hex").slice(0, 10);
}

function deriveDataAvailability(article) {
  const bodyLength = String(article?.body_text || "").trim().length;
  if (bodyLength >= 500) return "FULL";
  if (bodyLength >= 100) return "SUMMARY";
  return "METADATA ONLY";
}

function buildUserPrompt(article) {
  const headline = String(article.headline || "(missing)").slice(0, 500);
  const subheading = String(article.subheading || "(missing)").slice(0, 500);
  const byline = String(article.byline || "(unavailable from source API)").slice(0, 200);
  const publishDate = String(article.publish_date || "(missing)").slice(0, 100);
  const segment = String(article.segment || "(missing)").slice(0, 100);
  const bodyText = String(article.body_text || "").slice(0, MAX_BODY_TEXT_CHARS);
  const dataAvailability = deriveDataAvailability(article);
  return [
    `Headline: ${headline}`,
    `Subheading: ${subheading}`,
    `Byline: ${byline}`,
    "Byline interpretation rule: if a byline string exists, treat it as present even if formatting is compact or not fully human-friendly.",
    `Publish date: ${publishDate}`,
    `Segment: ${segment}`,
    `Data availability: ${dataAvailability}`,
    "",
    "Article body:",
    bodyText,
  ].join("\n");
}

function normalizeBylineRelatedFinding(finding, article) {
  const byline = stripToPlainText(article?.byline || "");
  if (!byline) return finding;
  const merged = `${finding.issue} ${finding.evidence} ${finding.impact} ${finding.fix}`.toLowerCase();
  if (!/\bbyline\b/.test(merged)) return finding;
  if (!/\b(broken|malformed|missing|unavailable|no byline)\b/.test(merged)) return finding;
  return {
    ...finding,
    issue: "Author context could be clearer",
    evidence: `Byline present: ${byline}`,
    impact: "The page has a visible author name, but stronger author context or profile linking could improve trust signals.",
    fix: "Keep the existing byline and add author profile, beat context, or stronger source attribution where useful.",
  };
}

function buildRepairPrompt(article, rawDraft) {
  return `${buildUserPrompt(article)}\n\nConvert the following audit draft into the required JSON shape without inventing new facts:\n${String(rawDraft || "").slice(0, 5000)}`;
}

function validateArticleInput(article) {
  if (!article || typeof article !== "object") return "Missing or invalid 'article' in request body.";
  const headline = String(article.headline || "").trim();
  const bodyText = String(article.body_text || "").trim();
  if (!headline) return "Article headline is required.";
  if (bodyText.length < 80) return "Article body is too short to analyse safely.";
  if (JSON.stringify(article).length > MAX_ARTICLE_PAYLOAD_CHARS) return "Article payload is too large.";
  return "";
}

function resolveAiConfig(provider, model, costProfile) {
  if (provider === "openai") {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: model || (costProfile === "low" ? DEFAULT_OPENAI_LOW_COST_MODEL : DEFAULT_OPENAI_STANDARD_MODEL),
    };
  }
  return {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: model || (costProfile === "low" ? DEFAULT_LOW_COST_MODEL : DEFAULT_STANDARD_MODEL),
  };
}

async function fetchWithTimeout(url, options, timeoutMs = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestAnthropicAnalysis({ apiKey, model, systemPrompt, article, userPrompt, maxTokens = 1400 }) {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt || buildUserPrompt(article) }],
    }),
  }, 22000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upstream API error: ${errText.slice(0, 500)}`);
  }
  const data = await response.json();
  return {
    text: data.content?.find((block) => block.type === "text")?.text || "",
    usage: data.usage || null,
  };
}

async function requestOpenAiAnalysis({ apiKey, model, systemPrompt, article, userPrompt, maxTokens = 1400 }) {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt || buildUserPrompt(article) }] },
      ],
      max_output_tokens: maxTokens,
      store: false,
    }),
  }, 22000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upstream API error: ${errText.slice(0, 500)}`);
  }
  const data = await response.json();
  return {
    text: data.output_text || "",
    usage: data.usage || null,
  };
}

async function requestDeepAnalysis({ config, systemPrompt, article, repairText = "", userPrompt = "", maxTokens = 1400 }) {
  const prompt = repairText
    ? `${systemPrompt}\n\nYour previous answer was not usable. Convert it into the required JSON shape now. Keep the same meaning and stay grounded in the supplied article only.\nPrevious answer:\n${repairText.slice(0, 5000)}`
    : systemPrompt;

  return config.provider === "openai"
    ? requestOpenAiAnalysis({ apiKey: config.apiKey, model: config.model, systemPrompt: prompt, article, userPrompt, maxTokens })
    : requestAnthropicAnalysis({ apiKey: config.apiKey, model: config.model, systemPrompt: prompt, article, userPrompt, maxTokens });
}

function normalizeEvidence(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokenOverlapScore(needle, haystack) {
  const needleTokens = normalizeEvidence(needle).split(" ").filter(Boolean);
  if (!needleTokens.length) return 0;
  const haystackTokens = new Set(normalizeEvidence(haystack).split(" ").filter(Boolean));
  const matched = needleTokens.filter((token) => haystackTokens.has(token)).length;
  return matched / needleTokens.length;
}

function isGroundedEvidence(item, articleText) {
  const normalized = normalizeEvidence(item);
  if (!normalized || normalized.length < 6) return false;
  if (normalizeEvidence(articleText).includes(normalized)) return true;
  return tokenOverlapScore(normalized, articleText) >= 0.55;
}

function coerceTier(value, articleText) {
  const cleaned = String(value || "").toUpperCase();
  if (["T1", "T2", "T3"].includes(cleaned)) return cleaned;
  const text = normalizeEvidence(articleText);
  if (/\b(tax|insurance|loan|investment|mutual fund|stocks|trading|banking|policy rate)\b/.test(text)) return "T1";
  if (/\b(business|economy|startup|market|ai|technology|government|policy)\b/.test(text)) return "T2";
  return "T3";
}

function coerceActionTag(value, findings = []) {
  const raw = String(value || "").toUpperCase();
  if (["KEEP", "IMPROVE", "DE-INDEX", "REDIRECT"].includes(raw)) return raw;
  const merged = `${raw} ${findings.map((item) => item.issue || "").join(" ")} ${findings.map((item) => item.impact || "").join(" ")}`.toUpperCase();
  if (merged.includes("NOINDEX") || merged.includes("DE-INDEX")) return "DE-INDEX";
  if (merged.includes("REDIRECT")) return "REDIRECT";
  if (merged.includes("KEEP") || merged.includes("RETAIN")) return "KEEP";
  return "IMPROVE";
}

function coerceConfidence(value) {
  const cleaned = String(value || "").toLowerCase();
  if (["high", "medium", "low"].includes(cleaned)) return cleaned;
  return "medium";
}

function mapActionTagToClassification(actionTag) {
  if (actionTag === "KEEP") return "Keep";
  if (actionTag === "IMPROVE") return "Overhaul";
  return "De-index";
}

function normalizeFinding(finding, articleText, fallbackArea = "Helpfulness") {
  if (!finding || typeof finding !== "object") return null;
  const areaRaw = String(finding.area || fallbackArea).trim();
  const area = /trust/i.test(areaRaw) ? "Trust" : /spam/i.test(areaRaw) ? "Spam Risk" : "Helpfulness";
  const issue = stripToPlainText(finding.issue || "");
  const impact = stripToPlainText(finding.impact || "");
  const fix = stripToPlainText(finding.fix || "");
  let evidence = stripToPlainText(finding.evidence || "");
  if (!issue || !impact || !fix) return null;
  if (!evidence) evidence = "Unavailable from supplied article";
  if (evidence !== "Unavailable from supplied article" && !isGroundedEvidence(evidence, articleText)) {
    evidence = "Evidence needs editorial review against the supplied page copy.";
  }
  return { area, issue, evidence, impact, fix };
}

function normalizeModelResult(result, article) {
  if (!result || typeof result !== "object") return null;
  const articleText = [article.headline, article.subheading, article.byline, article.body_text].join(" ");
  const rawFindings = Array.isArray(result.findings) ? result.findings : [];
  const findings = rawFindings
    .map((finding) => normalizeFinding(finding, articleText))
    .map((finding) => finding ? normalizeBylineRelatedFinding(finding, article) : null)
    .filter(Boolean)
    .slice(0, 6);

  const actionTag = coerceActionTag(result.action_tag, findings);
  return {
    tier: coerceTier(result.tier, articleText),
    data_availability: ["FULL", "SUMMARY", "METADATA ONLY"].includes(String(result.data_availability || "").toUpperCase())
      ? String(result.data_availability).toUpperCase()
      : deriveDataAvailability(article),
    action_tag: actionTag,
    page_classification: mapActionTagToClassification(actionTag),
    confidence: coerceConfidence(result.confidence),
    executive_summary: stripToPlainText(result.executive_summary || ""),
    editorial_flag: stripToPlainText(result.editorial_flag || "NONE") || "NONE",
    findings,
    next_steps: Array.isArray(result.next_steps)
      ? result.next_steps.map((step) => stripToPlainText(step)).filter(Boolean).slice(0, 2)
      : [],
  };
}

function tryRepairTruncatedJson(text) {
  let base = text;
  const quoteCount = (base.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) base += "\"";
  const opens = (base.match(/\{/g) || []).length;
  const closes = (base.match(/\}/g) || []).length;
  const openBrackets = (base.match(/\[/g) || []).length;
  const closeBrackets = (base.match(/\]/g) || []).length;
  const needBraces = Math.max(0, opens - closes);
  const needBrackets = Math.max(0, openBrackets - closeBrackets);
  const candidates = [
    base + "}".repeat(needBraces) + "]".repeat(needBrackets),
    base + "]".repeat(needBrackets) + "}".repeat(needBraces),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function extractJsonCandidate(text) {
  const raw = String(text || "").replace(/```json|```/gi, "").trim();
  if (!raw) return "";
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  return raw;
}

function parseCandidateJson(text) {
  const candidate = extractJsonCandidate(text);
  if (!candidate) return { parsed: null, repaired: false, cleaned: "" };
  try {
    return { parsed: JSON.parse(candidate), repaired: false, cleaned: candidate };
  } catch {
    const repaired = tryRepairTruncatedJson(candidate);
    return { parsed: repaired, repaired: Boolean(repaired), cleaned: candidate };
  }
}

function captureSection(raw, label, endLabels) {
  const startRegex = new RegExp(`${label}\\s*:`, "i");
  const startMatch = raw.match(startRegex);
  if (!startMatch || startMatch.index === undefined) return "";
  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = raw.length;
  const tail = raw.slice(startIndex);
  for (const endLabel of endLabels) {
    const endRegex = new RegExp(`\\n${endLabel}\\s*:`, "i");
    const endMatch = tail.match(endRegex);
    if (endMatch && endMatch.index !== undefined) {
      endIndex = Math.min(endIndex, startIndex + endMatch.index);
    }
  }
  return raw.slice(startIndex, endIndex).trim();
}

function parseBulletList(chunk) {
  return String(chunk || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseMarkdownAudit(text, article) {
  const raw = normalizeWhitespace(text);
  if (!raw) return null;
  const summary = captureSection(raw, "Summary", ["Action", "Tier", "Confidence", "Editorial Flag", "Findings", "Next Steps"]);
  const action = captureSection(raw, "Action", ["Tier", "Confidence", "Editorial Flag", "Findings", "Next Steps"]);
  const tier = captureSection(raw, "Tier", ["Confidence", "Editorial Flag", "Findings", "Next Steps"]);
  const confidence = captureSection(raw, "Confidence", ["Editorial Flag", "Findings", "Next Steps"]);
  const editorialFlag = captureSection(raw, "Editorial Flag", ["Findings", "Next Steps"]);
  const findingsChunk = captureSection(raw, "Findings", ["Next Steps"]);
  const nextStepsChunk = captureSection(raw, "Next Steps", []);

  const findings = String(findingsChunk || "")
    .split(/\n(?=(?:Area|Issue)\s*:)/i)
    .map((block) => {
      const issue = block.match(/Issue\s*:\s*([^\n]+)/i)?.[1]?.trim() || block.split("\n")[0]?.trim() || "";
      const area = block.match(/Area\s*:\s*([^\n]+)/i)?.[1]?.trim() || "Helpfulness";
      const evidence = block.match(/Evidence\s*:\s*([^\n]+)/i)?.[1]?.trim() || "Unavailable from supplied article";
      const impact = block.match(/Impact\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
      const fix = block.match(/Fix\s*:\s*([^\n]+)/i)?.[1]?.trim() || "";
      return { area, issue, evidence, impact, fix };
    })
    .filter((item) => item.issue || item.fix);

  const parsed = normalizeModelResult({
    tier,
    data_availability: deriveDataAvailability(article),
    action_tag: action,
    confidence,
    executive_summary: summary || raw.slice(0, 400),
    editorial_flag: editorialFlag || "NONE",
    findings,
    next_steps: parseBulletList(nextStepsChunk),
  }, article);

  return parsed;
}

function salvageNarrativeAudit(text, article) {
  const raw = normalizeWhitespace(text);
  if (!raw) return null;
  const sentences = raw.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const summary = sentences.slice(0, 3).join(" ").slice(0, 500);
  const fixes = sentences.filter((item) => /\b(add|improve|rewrite|clarify|include|update|cite|show|explain|strengthen)\b/i.test(item));
  const issues = sentences.filter((item) => /\b(weak|missing|unclear|thin|generic|unsupported|no|lacks|risk)\b/i.test(item));
  const findings = [
    {
      area: "Helpfulness",
      issue: stripToPlainText(issues[0] || "The page needs a clearer, more useful answer for readers."),
      evidence: "Evidence needs editorial review against the supplied page copy.",
      impact: stripToPlainText(issues[1] || "Readers may leave the page without getting a complete or trustworthy answer."),
      fix: stripToPlainText(fixes[0] || "Rewrite the page with clearer sourcing, specific details, and a direct answer near the top."),
    },
  ];

  return normalizeModelResult({
    tier: "T2",
    data_availability: deriveDataAvailability(article),
    action_tag: /\bnoindex|de-index|redirect\b/i.test(raw) ? "DE-INDEX" : "IMPROVE",
    confidence: "low",
    executive_summary: summary || "The page returned a partially usable audit response and needs editorial review.",
    editorial_flag: "Recovered from a non-standard model response. Review before sharing externally.",
    findings,
    next_steps: [
      stripToPlainText(fixes[0] || "Strengthen sourcing and add concrete details."),
      stripToPlainText(fixes[1] || "Clarify the main takeaway near the top of the page."),
      stripToPlainText(fixes[2] || "Check the page manually before final editorial action."),
    ],
  }, article);
}

export function validateAnalysisResult(result, article) {
  if (!result || typeof result !== "object") return false;
  if (!["Keep", "Overhaul", "De-index"].includes(result.page_classification)) return false;
  if (!["KEEP", "IMPROVE", "DE-INDEX", "REDIRECT"].includes(result.action_tag)) return false;
  if (!["T1", "T2", "T3"].includes(result.tier)) return false;
  if (!["FULL", "SUMMARY", "METADATA ONLY"].includes(result.data_availability)) return false;
  if (typeof result.executive_summary !== "string" || result.executive_summary.trim().length < 20) return false;
  if (!Array.isArray(result.findings) || result.findings.length < 1 || result.findings.length > 6) return false;
  if (!result.findings.every((finding) =>
    finding &&
    typeof finding.area === "string" && finding.area.trim() &&
    typeof finding.issue === "string" && finding.issue.trim().length >= 8 &&
    typeof finding.evidence === "string" && finding.evidence.trim() &&
    typeof finding.impact === "string" && finding.impact.trim().length >= 10 &&
    typeof finding.fix === "string" && finding.fix.trim().length >= 10
  )) return false;
  if (!Array.isArray(result.next_steps) || result.next_steps.length < 1 || result.next_steps.length > 2) return false;
  if (!result.next_steps.every((step) => typeof step === "string" && step.trim().length >= 6)) return false;

  const articleText = [article.headline, article.subheading, article.byline, article.body_text].join(" ");
  return result.findings.every((finding) =>
    finding.evidence === "Unavailable from supplied article" ||
    finding.evidence === "Evidence needs editorial review against the supplied page copy." ||
    isGroundedEvidence(finding.evidence, articleText)
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authResult = verifyToken(req.headers.authorization);
  if (!authResult.valid) return res.status(401).json({ error: authResult.reason });

  const article = req.body?.article;
  const aiProvider = req.body?.ai_provider === "openai" ? "openai" : "anthropic";
  const aiModel = typeof req.body?.ai_model === "string" ? req.body.ai_model.trim() : "";
  const costProfile = req.body?.cost_profile === "low" ? "low" : "standard";
  const articleError = validateArticleInput(article);
  if (articleError) return res.status(400).json({ error: articleError });

  if (!supabase) {
    return res.status(500).json({ error: "Rate limiting not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Refusing to process requests until this is set up." });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";

  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc("check_and_increment_rate_limit", {
    p_key: `analyze:${ip}`,
    p_window_seconds: 60,
    p_limit: PER_MINUTE_LIMIT,
  });
  if (rateLimitError) return res.status(500).json({ error: "Rate limit check failed", detail: rateLimitError.message });
  if (!withinRateLimit) return res.status(429).json({ error: "Rate limit exceeded. Wait a minute and try again." });

  const { data: withinDailyCap, error: dailyCapError } = await supabase.rpc("check_and_increment_daily_cap", { p_cap: DAILY_BUDGET_CAP });
  if (dailyCapError) return res.status(500).json({ error: "Daily cap check failed", detail: dailyCapError.message });
  if (!withinDailyCap) return res.status(429).json({ error: `Daily request cap reached (${DAILY_BUDGET_CAP}/day). Resets at midnight UTC.` });

  const config = resolveAiConfig(aiProvider, aiModel, costProfile);
  if (!config.apiKey) {
    return res.status(500).json({ error: `Server misconfigured: ${config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} not set.` });
  }

  const configSignal = {
    provider: config.provider,
    model: config.model,
    key_fingerprint: fingerprintKey(config.apiKey),
    key_env: config.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY",
  };

  try {
    let repaired = false;
    let upstream = await requestDeepAnalysis({ config, systemPrompt: SYSTEM_PROMPT_V2, article, maxTokens: 1400 });
    let cleaned = String(upstream.text || "").trim();
    let parsed = normalizeModelResult(parseCandidateJson(cleaned).parsed, article);

    if (!validateAnalysisResult(parsed, article)) {
      parsed = parseMarkdownAudit(cleaned, article);
    }

    if (!validateAnalysisResult(parsed, article)) {
      upstream = await requestDeepAnalysis({
        config,
        systemPrompt: SYSTEM_PROMPT_V2,
        article,
        repairText: buildRepairPrompt(article, cleaned),
        maxTokens: 1400,
      });
      cleaned = String(upstream.text || "").trim();
      const repairedCandidate = parseCandidateJson(cleaned);
      repaired = repairedCandidate.repaired;
      parsed = normalizeModelResult(repairedCandidate.parsed, article);
      if (!validateAnalysisResult(parsed, article)) {
        parsed = parseMarkdownAudit(cleaned, article);
      }
    }

    if (!validateAnalysisResult(parsed, article)) {
      parsed = salvageNarrativeAudit(cleaned, article);
    }

    if (!validateAnalysisResult(parsed, article)) {
      return res.status(502).json({
        error: "Analysis request failed",
        detail: "The selected model returned an unusable response for this page after multiple attempts. Please retry the page.",
        config_signal: configSignal,
      });
    }

    parsed._usage = upstream.usage || null;
    parsed._model = config.model;
    parsed._provider = config.provider;
    parsed._cost_profile = costProfile;
    parsed._config_signal = configSignal;
    if (repaired) parsed._was_truncated = true;
    return res.status(200).json(parsed);
  } catch (error) {
    if (String(error).includes("AbortError")) {
      return res.status(504).json({
        error: "Analysis request failed",
        detail: "The page analysis took too long in this run. Please retry the page, or run a smaller batch.",
        config_signal: configSignal,
      });
    }
    if (String(error).startsWith("Error: Upstream API error:")) {
      const detail = String(error).replace(/^Error: Upstream API error:\s*/, "").slice(0, 400);
      if (/not_found_error/i.test(detail) || /model:/i.test(detail)) {
        return res.status(502).json({
          error: "Analysis request failed",
          detail: "Configured Anthropic model is not available for this workspace.",
          config_signal: configSignal,
        });
      }
      return res.status(502).json({
        error: "Analysis request failed",
        detail: "The selected provider could not complete the audit right now. Please retry the page.",
        config_signal: configSignal,
      });
    }
    return res.status(500).json({
      error: "Analysis request failed",
      detail: "The analysis service hit an internal issue before a usable recommendation could be returned.",
      config_signal: configSignal,
    });
  }
}
