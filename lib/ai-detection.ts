import "server-only";

const COPYLEAKS_LOGIN_URL = "https://id.copyleaks.com/v3/account/login/api";
const COPYLEAKS_DETECT_URL = "https://api.copyleaks.com/v2/writer-detector";

export const AI_DETECTION_PROVIDER = "copyleaks";
export const AI_DETECTION_THRESHOLD = Number(process.env.AI_DETECTION_THRESHOLD ?? 20);

type CopyleaksResponse = {
  modelVersion?: string;
  summary?: { ai?: number; human?: number };
};

type TokenCache = { value: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export type AiDetectionResult = {
  aiScore: number;
  humanScore: number;
  blocked: boolean;
  threshold: number;
  provider: typeof AI_DETECTION_PROVIDER;
  model: string;
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

export async function detectAiContent(text: string): Promise<AiDetectionResult> {
  if (text.length < 255) throw new Error("AI_DETECTION_TEXT_TOO_SHORT");
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
  const parsed = parseCopyleaksResult(await response.json() as CopyleaksResponse);
  return {
    ...parsed,
    blocked: parsed.aiScore >= AI_DETECTION_THRESHOLD,
    threshold: AI_DETECTION_THRESHOLD,
    provider: AI_DETECTION_PROVIDER,
  };
}
