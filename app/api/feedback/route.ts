import { z } from "zod";
import { getCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { enforceActionLimit } from "../../../lib/rate-limit";
import { rejectUnsafeMutation } from "../../../lib/request-security";
const schema = z.object({ checkId: z.string().cuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).strict();

export async function POST(request: Request) {
  const unsafeRequest = rejectUnsafeMutation(request, 10_000); if (unsafeRequest) return unsafeRequest;
  const user = await getCurrentUser(); if (!user || user.id === "local-admin") return Response.json({ error: "Sign in to save feedback." }, { status: 401 });
  if (!(await enforceActionLimit("rating", user.id, 10))) return Response.json({ error: "Too many feedback requests. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Invalid feedback." }, { status: 400 });
  const check = await prisma.checkMetadata.findFirst({ where: { id: parsed.data.checkId, userId: user.id } }); if (!check) return Response.json({ error: "Check not found." }, { status: 404 });
  await prisma.feedback.upsert({ where: { checkId: check.id }, update: { rating: parsed.data.rating, comment: parsed.data.comment }, create: { checkId: check.id, userId: user.id, rating: parsed.data.rating, comment: parsed.data.comment } });

  let emailed = false;
  if (process.env.RESEND_API_KEY && process.env.ACCESS_NOTIFICATION_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ACCESS_NOTIFICATION_FROM,
        to: ["vaibhav.singh@indianexpress.com"],
        reply_to: [user.email],
        subject: `DCT AI Independent rating received: ${parsed.data.rating}/5`,
        text: `DCT AI Independent tool rating submitted\n\nFrom: ${user.email}\nRating: ${parsed.data.rating}/5\nPublication: ${check.publication}\nCheck ID: ${check.id}\nComment: ${parsed.data.comment?.trim() || "No additional comment."}`,
      }),
    }).catch(() => null);
    emailed = Boolean(response?.ok);
  }

  await prisma.auditEvent.create({ data: { actorId: user.id, event: emailed ? "feedback.rating_emailed" : "feedback.rating_saved", outcome: "success", metadata: { checkId: check.id, rating: parsed.data.rating, emailed } } }).catch(() => undefined);
  return Response.json({ saved: true, emailed });
}
