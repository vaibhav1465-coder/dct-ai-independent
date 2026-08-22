import "server-only";

const COPYLEAKS_LOGIN_URL = "https://id.copyleaks.com/v3/account/login/api";
const COPYLEAKS_DETECT_URL = "https://api.copyleaks.com/v2/writer-detector";
const MIN_PROVIDER_TEXT_LENGTH = 255;

export const AI_DETECTION_PROVIDER = "copyleaks";
export const AI_DETECTION_THRESHOLD = Number(process.env.AI_DETECTION_THRESHOLD ?? 20);

type CviComponent = "headline" | "body";

type CopyleaksResponse = {
  modelVersion?: string;
  summary?: { ai?: number; human?: number };
};

type TokenCache = { value: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export type AiDetectionResult = {
  aiScore: number;
  humanScore: number;
  flagged: boolean;
  threshold: number;
  provider: typeof AI_DETECTION_PROVIDER;
  model: string;
  source: "provider" | "fallback";
  component: CviComponent;
};

export type CviDetectionResult = {
  verdict: "PASS" | "WARNING";
  threshold: number;
  provider: typeof AI_DETECTION_PROVIDER;
  model: string;
  headline: AiDetectionResult;
  body: AiDetectionResult;
  highestScore: number;
  flaggedComponents: CviComponent[];
};

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const email = process.env.COPYLEAKS_EMAIL?.trim();
  const key = process.env.COPYLEAKS_API_KEY?.trim();
  if (!email || !key) throw new Error("AI_DETECTION_NOT_CONFIGURED");

  const response = await fetch(COPYLEAKS_LOGIN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, key }),
    cache: "no-store",
    signal: timeoutSignal(15_000),
  });
  if (!response.ok) throw new Error(`AI_DETECTION_AUTH_FAILED:${response.status}`);
  const payload = await response.json() as { access_token?: string; ".expires"?: string };
  if (!payload.access_token) throw new Error("AI_DETECTION_AUTH_FAILED:missing_token");
  const parsedExpiry = payload[".expires"] ? Date.parse(payload[".expires"]) : NaN;
  tokenCache = { value: payload.access_token, expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 47 * 60 * 60 * 1_000 };
  return tokenCache.value;
}

export function parseCopyleaksResult(payload: CopyleaksResponse) {
  const ratio = payload.summary?.ai;
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new Error("AI_DETECTION_INVALID_RESPONSE");
  }
  const aiScore = Math.round(ratio * 10_000) / 100;
  return {
    aiScore,
    humanScore: Math.round((100 - aiScore) * 100) / 100,
    model: payload.modelVersion?.trim() || "unknown",
  };
}

function scoreFallback(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  const words = normalized.split(/\s+/).filter(Boolean);
  const sentences = normalized.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const averageSentenceLength = sentences.length ? words.length / sentences.length : words.length;
  const sentenceLengths = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length);
  const lengthVariance = sentenceLengths.length > 1
    ? sentenceLengths.reduce((sum, length) => sum + Math.abs(length - averageSentenceLength), 0) / sentenceLengths.length
    : 0;
  const lower = normalized.toLowerCase();
  const genericPhrases = [
    "furthermore",
    "moreover",
    "in conclusion",
    "it is worth noting",
    "this highlights",
    "delves into",
    "underscores",
    "plays a crucial role",
  ];
  const phraseHits = genericPhrases.filter((phrase) => lower.includes(phrase)).length;
  const punctuationMarks = (normalized.match(/[,:;()]/g) ?? []).length;
  const specificSignals = (normalized.match(/\b\d{1,4}\b|\b[A-Z][a-z]+\s[A-Z][a-z]+\b|"/g) ?? []).length;
  const polishScore = words.length >= 80 && punctuationMarks > sentences.length * 1.8 ? 10 : 0;
  const uniformityScore = sentences.length >= 3 && averageSentenceLength >= 18 && lengthVariance < 4 ? 18 : 0;
  const genericScore = Math.min(phraseHits * 12, 28);
  const headlineGenericScore = words.length < 18 && /\b(impact|major|significant|key|amid|raises questions|sparks debate)\b/i.test(normalized) ? 14 : 0;
  const specificityCredit = Math.min(specificSignals * 3, 18);
  return Math.max(0, Math.min(100, 8 + polishScore + uniformityScore + genericScore + headlineGenericScore - specificityCredit));
}

async function detectProviderText(text: string) {
  const token = await getAccessToken();
  const scanId = crypto.randomUUID();
  const response = await fetch(`${COPYLEAKS_DETECT_URL}/${scanId}/check`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ text, sandbox: false, explain: false, sensitivity: 2 }),
    cache: "no-store",
    signal: timeoutSignal(45_000),
  });
  if (!response.ok) throw new Error(`AI_DETECTION_PROVIDER_FAILED:${response.status}`);
  return parseCopyleaksResult(await response.json() as CopyleaksResponse);
}

async function detectAiComponent(component: CviComponent, text: string): Promise<AiDetectionResult> {
  const normalized = text.trim();
  const fallback = () => {
    const aiScore = Math.round(scoreFallback(normalized) * 10) / 10;
    return {
      aiScore,
      humanScore: Math.round((100 - aiScore) * 10) / 10,
      flagged: aiScore >= AI_DETECTION_THRESHOLD,
      threshold: AI_DETECTION_THRESHOLD,
      provider: AI_DETECTION_PROVIDER as typeof AI_DETECTION_PROVIDER,
      model: "cvi-signal-fallback-v1",
      source: "fallback" as const,
      component,
    };
  };

  if (normalized.length < MIN_PROVIDER_TEXT_LENGTH) return fallback();
  const parsed = await detectProviderText(normalized);
  return {
    ...parsed,
    flagged: parsed.aiScore >= AI_DETECTION_THRESHOLD,
    threshold: AI_DETECTION_THRESHOLD,
    provider: AI_DETECTION_PROVIDER,
    source: "provider",
    component,
  };
}

export async function detectAiContent(text: string): Promise<AiDetectionResult> {
  return detectAiComponent("body", text);
}

export async function detectCviSubmission(input: { headline: string; article: string }): Promise<CviDetectionResult> {
  const [headline, body] = await Promise.all([
    detectAiComponent("headline", input.headline),
    detectAiComponent("body", input.article),
  ]);
  const flaggedComponents = [headline, body].filter((item) => item.flagged).map((item) => item.component);
  return {
    verdict: flaggedComponents.length ? "WARNING" : "PASS",
    threshold: AI_DETECTION_THRESHOLD,
    provider: AI_DETECTION_PROVIDER,
    model: [headline.model, body.model].filter(Boolean).join(" + "),
    headline,
    body,
    highestScore: Math.max(headline.aiScore, body.aiScore),
    flaggedComponents,
  };
}
