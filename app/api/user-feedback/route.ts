import { z } from "zod";
import { getCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { enforceActionLimit } from "../../../lib/rate-limit";
import { rejectUnsafeMutation } from "../../../lib/request-security";

const schema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});
const ADMIN_RECIPIENTS = ["vaibhav.singh@indianexpress.com", "chandan.kumar@indianexpress.com"];
const RESEND_TEST_RECIPIENTS = ["vaibhav.singh@indianexpress.com"];

export async function POST(request: Request) {
  const unsafeRequest = rejectUnsafeMutation(request, 10_000);
  if (unsafeRequest) return unsafeRequest;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to send feedback." }, { status: 401 });
  if (!(await enforceActionLimit("user-feedback", user.id, 5))) return Response.json({ error: "Too many feedback requests. Try again later." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please add a subject and a clear message." }, { status: 400 });

  await prisma.auditEvent.create({ data: { actorId: user.id, event: "feedback.submitted", outcome: "success", metadata: { email: user.email, subject: parsed.data.subject, message: parsed.data.message } } });

  if (!process.env.RESEND_API_KEY || !process.env.ACCESS_NOTIFICATION_FROM) {
    await prisma.auditEvent.create({ data: { actorId: user.id, event: "feedback.email_skipped", outcome: "success", metadata: { reason: "email_not_configured" } } });
    return Response.json({ ok: true, emailed: false });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.ACCESS_NOTIFICATION_FROM,
      to: getFeedbackRecipients(process.env.ACCESS_NOTIFICATION_FROM),
      reply_to: [user.email],
      subject: `DCT AI Independent Feedback: ${parsed.data.subject}`,
      text: `Feedback from: ${user.email}\n\n${parsed.data.message}`,
    }),
  });

  if (!response.ok) {
    await prisma.auditEvent.create({ data: { actorId: user.id, event: "feedback.email_failed", outcome: "failed", metadata: { status: response.status } } });
    return Response.json({ ok: true, emailed: false });
  }

  await prisma.auditEvent.create({ data: { actorId: user.id, event: "feedback.email_sent", outcome: "success" } });
  return Response.json({ ok: true });
}

function getFeedbackRecipients(from: string | undefined) {
  if (from?.toLowerCase().includes("@resend.dev")) return RESEND_TEST_RECIPIENTS;
  return ADMIN_RECIPIENTS;
}
