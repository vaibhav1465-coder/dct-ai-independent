import { getCurrentUser } from "../../../lib/auth";
import { runEditorialCheck, DCT_MODEL } from "../../../lib/anthropic";
import { enforceLimits } from "../../../lib/rate-limit";
import { outputSummary, validateCheck } from "../../../lib/validation";
import { prisma } from "../../../lib/prisma";
import { getArticleLabel } from "../../../lib/article-label";
import { detectAiContent } from "../../../lib/ai-detection";
import { rejectUnsafeMutation } from "../../../lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const started = Date.now();
  const unsafeRequest = rejectUnsafeMutation(request);
  if (unsafeRequest) return unsafeRequest;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in with an approved Indian Express account." }, { status: 401 });
  try { if (!(await enforceLimits(user.id))) return Response.json({ error: "Usage limit reached. Try again later." }, { status: 429 }); } catch { return Response.json({ error: "The safety limit service is unavailable." }, { status: 503 }); }
  let raw: unknown; try { raw = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const payload = typeof raw === "object" && raw ? raw as Record<string, unknown> : null;
  const requestKey = typeof payload?.requestKey === "string" && payload.requestKey.trim() ? payload.requestKey.trim() : crypto.randomUUID();
  const parsed = validateCheck({ publication: payload?.publication, headline: payload?.headline, subhead: payload?.subhead, article: payload?.article }); if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const wordCount = parsed.data.article.split(/\s+/).filter(Boolean).length;
  const articleLabel = getArticleLabel(parsed.data.headline, parsed.data.article);
  const submissionKey = `submission-lock:${user.id}:${requestKey}`;
  await prisma.setting.deleteMany({ where: { key: { startsWith: "submission-lock:" }, updatedAt: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => undefined);
  try {
    await prisma.setting.create({ data: { key: submissionKey, publicValue: "running", updatedBy: user.id } });
  } catch {
    return Response.json({ error: "This editorial check is already running. Please wait for the first result." }, { status: 409 });
  }
  try {
    let detection;
    try {
      detection = await detectAiContent(parsed.data.article);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_DETECTION_PROVIDER_FAILED";
      const category = message === "AI_DETECTION_NOT_CONFIGURED" ? "ai_detection_not_configured" : message === "AI_DETECTION_TEXT_TOO_SHORT" ? "ai_detection_text_too_short" : "ai_detection_provider_failure";
      if (user.id !== "local-admin") {
        await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, articleContent: parsed.data.article, wordCount, durationMs: Date.now() - started, provider: "copyleaks", model: "unavailable", status: "FAILED", failureCategory: category } }).catch(() => undefined);
        await prisma.auditEvent.create({ data: { actorId: user.id, event: "ai_detection.failed", outcome: category, metadata: { articleLabel } } }).catch(() => undefined);
      }
      return Response.json({ error: category === "ai_detection_not_configured" ? "AI detection is not configured yet. Editorial coaching was not run." : category === "ai_detection_text_too_short" ? "Article copy must contain at least 255 characters for AI detection." : "AI detection is temporarily unavailable. Editorial coaching was not run." }, { status: 503 });
    }

    if (detection.blocked) {
      let checkId: string | null = null;
      if (user.id !== "local-admin") {
        const stored = await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, articleContent: parsed.data.article, wordCount, durationMs: Date.now() - started, provider: detection.provider, model: detection.model, status: "FAILED", failureCategory: "ai_content_detected", aiDetectionScore: detection.aiScore, aiDetectionPassed: false, aiDetectionProvider: detection.provider, aiDetectionModel: detection.model } });
        checkId = stored.id;
        await prisma.auditEvent.create({ data: { actorId: user.id, event: "ai_detection.blocked", outcome: "blocked", metadata: { checkId, aiScore: detection.aiScore, threshold: detection.threshold, articleLabel } } });
      }
      return Response.json({ code: "AI_CONTENT_DETECTED", checkId, aiDetection: detection, error: `AI-generated content estimate: ${detection.aiScore.toFixed(1)}%. This content appears to be AI-generated. Please humanise it before submitting it for editorial coaching.` }, { status: 422, headers: { "cache-control": "no-store" } });
    }

    const result = await runEditorialCheck(parsed.data); const summary = outputSummary(result.content); let checkId: string | null = null;
    if (user.id !== "local-admin") { const stored = await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, articleContent: parsed.data.article, outputContent: result.content, wordCount, durationMs: Date.now() - started, provider: "anthropic", model: DCT_MODEL, status: "SUCCEEDED", verdict: summary.verdict, primaryCategory: summary.category, reliability: result.repaired ? "REPAIRED" : "PASSED", inputTokens: result.usage.input, outputTokens: result.usage.output, aiDetectionScore: detection.aiScore, aiDetectionPassed: true, aiDetectionProvider: detection.provider, aiDetectionModel: detection.model } }); checkId = stored.id; await prisma.auditEvent.create({ data: { actorId: user.id, event: "analysis.completed", outcome: "success", metadata: { checkId, repaired: result.repaired, articleLabel, aiScore: detection.aiScore, aiDetectionProvider: detection.provider } } }); }
    return Response.json({ checkId, content: result.content, ...summary, reliability: result.repaired ? "Repaired" : "Passed", aiDetection: detection }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const category = error instanceof Error && error.message === "PROVIDER_NOT_CONFIGURED" ? "provider_not_configured" : error instanceof Error && error.message.startsWith("OUTPUT_INVALID") ? "output_validation" : "provider_failure";
    if (user.id !== "local-admin") await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, articleContent: parsed.data.article, wordCount, durationMs: Date.now() - started, provider: "anthropic", model: DCT_MODEL, status: "FAILED", failureCategory: category } }).catch(() => undefined);
    return Response.json({ error: category === "provider_not_configured" ? "The editorial engine is not configured yet." : "The editorial check could not be completed. No draft was stored." }, { status: 502 });
  } finally {
    await prisma.setting.delete({ where: { key: submissionKey } }).catch(() => undefined);
  }
}
