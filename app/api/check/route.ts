import { getCurrentUser } from "../../../lib/auth";
import { runEditorialCheck, DCT_MODEL } from "../../../lib/anthropic";
import { enforceLimits } from "../../../lib/rate-limit";
import { outputSummary, validateCheck } from "../../../lib/validation";
import { prisma } from "../../../lib/prisma";
import { getArticleLabel } from "../../../lib/article-label";
import { detectCviSubmission, type CviDetectionResult } from "../../../lib/ai-detection";
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
  const cviAction = payload?.cviAction === "CONTINUE" || payload?.cviAction === "CONTEST" ? payload.cviAction : null;
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
    let cvi: CviDetectionResult;
    try {
      cvi = await detectCviSubmission({ headline: parsed.data.headline, article: parsed.data.article });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI_DETECTION_PROVIDER_FAILED";
      const category = message === "AI_DETECTION_NOT_CONFIGURED" ? "ai_detection_not_configured" : "ai_detection_provider_failure";
      if (user.id !== "local-admin") {
        await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, wordCount, durationMs: Date.now() - started, provider: "cvi", model: "unavailable", status: "FAILED", failureCategory: category } }).catch(() => undefined);
        await prisma.auditEvent.create({ data: { actorId: user.id, event: "cvi.failed", outcome: category, metadata: { articleLabel } } }).catch(() => undefined);
      }
      return Response.json({ error: category === "ai_detection_not_configured" ? "Copy verification is not configured yet. Editorial coaching was not run." : "Copy verification is temporarily unavailable. Editorial coaching was not run." }, { status: 503, headers: { "cache-control": "no-store" } });
    }

    if (cvi.verdict === "WARNING" && !cviAction) {
      return Response.json({ code: "CVI_WARNING", cvi: publicCvi(cvi) }, { status: 200, headers: { "cache-control": "no-store" } });
    }

    const result = await runEditorialCheck(parsed.data); const summary = outputSummary(result.content); let checkId: string | null = null;
    if (user.id !== "local-admin") {
      const stored = await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, wordCount, durationMs: Date.now() - started, provider: "anthropic", model: DCT_MODEL, status: "SUCCEEDED", verdict: summary.verdict, primaryCategory: summary.category, reliability: result.repaired ? "REPAIRED" : "PASSED", inputTokens: result.usage.input, outputTokens: result.usage.output, aiDetectionScore: cvi.highestScore, aiDetectionPassed: cvi.verdict === "PASS", aiDetectionProvider: cvi.provider, aiDetectionModel: cvi.model, aiHeadlineScore: cvi.headline.aiScore, aiBodyScore: cvi.body.aiScore, aiDetectionThreshold: cvi.threshold, cviVerdict: cvi.verdict, cviAction } });
      checkId = stored.id;
      await prisma.auditEvent.create({ data: { actorId: user.id, event: cvi.verdict === "WARNING" ? "cvi.warning_proceeded" : "analysis.completed", outcome: "success", metadata: { checkId, repaired: result.repaired, articleLabel, headlineScore: cvi.headline.aiScore, bodyScore: cvi.body.aiScore, threshold: cvi.threshold, cviAction } } });
      if (cviAction === "CONTEST") await prisma.auditEvent.create({ data: { actorId: user.id, event: "cvi.contested", outcome: "logged", metadata: { checkId, headlineScore: cvi.headline.aiScore, bodyScore: cvi.body.aiScore, threshold: cvi.threshold, publication: parsed.data.publication } } });
    }
    return Response.json({ checkId, content: result.content, ...summary, reliability: result.repaired ? "Repaired" : "Passed", cvi: publicCvi(cvi) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const category = error instanceof Error && error.message === "PROVIDER_NOT_CONFIGURED" ? "provider_not_configured" : error instanceof Error && error.message.startsWith("OUTPUT_INVALID") ? "output_validation" : "provider_failure";
    if (user.id !== "local-admin") await prisma.checkMetadata.create({ data: { userId: user.id, publication: parsed.data.publication, headline: parsed.data.headline, subhead: parsed.data.subhead || null, articleLabel, wordCount, durationMs: Date.now() - started, provider: "anthropic", model: DCT_MODEL, status: "FAILED", failureCategory: category } }).catch(() => undefined);
    return Response.json({ error: category === "provider_not_configured" ? "The editorial engine is not configured yet." : "The editorial check could not be completed. No draft was stored." }, { status: 502 });
  } finally {
    await prisma.setting.delete({ where: { key: submissionKey } }).catch(() => undefined);
  }
}


function publicCvi(cvi: CviDetectionResult) {
  return {
    verdict: cvi.verdict,
    threshold: cvi.threshold,
    headline: {
      aiScore: cvi.headline.aiScore,
      humanScore: cvi.headline.humanScore,
      flagged: cvi.headline.flagged,
      threshold: cvi.headline.threshold,
      component: cvi.headline.component,
    },
    body: {
      aiScore: cvi.body.aiScore,
      humanScore: cvi.body.humanScore,
      flagged: cvi.body.flagged,
      threshold: cvi.body.threshold,
      component: cvi.body.component,
    },
    highestScore: cvi.highestScore,
    flaggedComponents: cvi.flaggedComponents,
  };
}
