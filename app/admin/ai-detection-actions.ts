"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, isAdmin } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import {
  AI_DETECTION_PROVIDER_SETTING_KEY,
  SUPPORTED_AI_DETECTION_PROVIDERS,
  normalizeAiDetectionProvider,
} from "../../lib/ai-detection-providers";

const providerSchema = z.enum(["copyleaks", "originality", "gptzero"]);

export async function updateAiDetectionProvider(formData: FormData) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) throw new Error("Administrator access required.");
  const provider = normalizeAiDetectionProvider(providerSchema.parse(formData.get("provider")));
  if (!SUPPORTED_AI_DETECTION_PROVIDERS.has(provider)) {
    throw new Error("This detector is visible for evaluation but is not connected yet.");
  }
  await prisma.setting.upsert({
    where: { key: AI_DETECTION_PROVIDER_SETTING_KEY },
    update: { publicValue: provider, updatedBy: admin.id },
    create: { key: AI_DETECTION_PROVIDER_SETTING_KEY, publicValue: provider, updatedBy: admin.id },
  });
  await prisma.auditEvent.create({
    data: {
      actorId: admin.id,
      event: "ai_detection.provider_selected",
      outcome: "success",
      metadata: { provider },
    },
  });
  revalidatePath("/admin");
}
