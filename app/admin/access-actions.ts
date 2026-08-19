"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, isAdmin } from "../../lib/auth";
import { getApprovedUserEmails, isIndianExpressEmail, saveApprovedUserEmails } from "../../lib/access-policy";
import { prisma } from "../../lib/prisma";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function addApprovedUser(formData: FormData) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) throw new Error("Administrator access required.");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) throw new Error("Enter a valid email address.");
  if (isIndianExpressEmail(parsed.data)) return;
  const emails = await getApprovedUserEmails();
  if (!emails.includes(parsed.data)) {
    await saveApprovedUserEmails([...emails, parsed.data], admin.id);
    await prisma.auditEvent.create({ data: { actorId: admin.id, event: "access.user_added", outcome: "success", metadata: { email: parsed.data } } });
  }
  revalidatePath("/admin");
}

export async function removeApprovedUser(email: string) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) throw new Error("Administrator access required.");
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new Error("Invalid email address.");
  const emails = await getApprovedUserEmails();
  if (emails.includes(parsed.data)) {
    await saveApprovedUserEmails(emails.filter((item) => item !== parsed.data), admin.id);
    await prisma.auditEvent.create({ data: { actorId: admin.id, event: "access.user_removed", outcome: "success", metadata: { email: parsed.data } } });
  }
  revalidatePath("/admin");
}
