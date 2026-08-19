import { prisma } from "./prisma";

const NOTIFICATION_EVENT = "access.notification_sent";

export function isAccessEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ACCESS_NOTIFICATION_FROM);
}

export async function sendFirstLoginAccessEmail(userId: string, email: string) {
  if (!isAccessEmailConfigured()) return;
  const alreadySent = await prisma.auditEvent.findFirst({ where: { actorId: userId, event: NOTIFICATION_EVENT, outcome: "success" }, select: { id: true } });
  if (alreadySent) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ACCESS_NOTIFICATION_FROM,
        to: [email],
        reply_to: ["vaibhav.singh@indianexpress.com", "chandan.kumar@indianexpress.com"],
        subject: "Access granted to the Digital Coaching Tool",
        text: `Hello,\n\nVaibhav Singh (vaibhav.singh@indianexpress.com) and Chandan Kumar (chandan.kumar@indianexpress.com) have granted you access to the Digital Coaching Tool.\n\nYour account has signed in successfully.\n\nDigital Coaching Tool\nIndian Express Group`,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
    await prisma.auditEvent.create({ data: { actorId: userId, event: NOTIFICATION_EVENT, outcome: "success", metadata: { email } } });
  } catch (error) {
    await prisma.auditEvent.create({ data: { actorId: userId, event: NOTIFICATION_EVENT, outcome: "failed", metadata: { email, reason: error instanceof Error ? error.message : "Unknown delivery error" } } });
  }
}
