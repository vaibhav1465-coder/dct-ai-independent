import { prisma } from "./prisma";

const ACCESS_LIST_KEY = "access.approved_emails";
const DIRECT_ACCESS_DOMAINS = ["@indianexpress.com", "@expressindia.com"];

export function isIndianExpressEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return DIRECT_ACCESS_DOMAINS.some((domain) => normalized.endsWith(domain));
}

export async function getApprovedUserEmails() {
  const setting = await prisma.setting.findUnique({ where: { key: ACCESS_LIST_KEY }, select: { publicValue: true } });
  if (!setting?.publicValue) return [];
  try {
    const value = JSON.parse(setting.publicValue);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean))].sort();
  } catch {
    return [];
  }
}

export async function saveApprovedUserEmails(emails: string[], updatedBy: string) {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter((email) => email && !isIndianExpressEmail(email)))].sort();
  await prisma.setting.upsert({
    where: { key: ACCESS_LIST_KEY },
    create: { key: ACCESS_LIST_KEY, publicValue: JSON.stringify(normalized), updatedBy },
    update: { publicValue: JSON.stringify(normalized), updatedBy },
  });
}

export async function isApprovedUserEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return isIndianExpressEmail(normalized) || (await getApprovedUserEmails()).includes(normalized);
}
