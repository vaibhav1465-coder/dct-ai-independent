export type AiDetectionProviderId = "copyleaks" | "originality" | "gptzero";

export type AiDetectionProviderStatus = "active" | "candidate" | "not_connected";

export type AiDetectionProviderProfile = {
  id: AiDetectionProviderId;
  name: string;
  status: AiDetectionProviderStatus;
  trustNote: string;
  usageNote: string;
  minTextNote: string;
  adminNote: string;
};

export const AI_DETECTION_PROVIDER_SETTING_KEY = "ai-detection:active-provider";

export const AI_DETECTION_PROVIDER_PROFILES: AiDetectionProviderProfile[] = [
  {
    id: "copyleaks",
    name: "Copyleaks",
    status: "active",
    trustNote: "Currently wired in this replica. Use with caution because sample quality must be newsroom-tested.",
    usageNote: "Usage depends on Copyleaks account plan and API quota.",
    minTextNote: "Provider calls are skipped for article copy of 200 characters or less.",
    adminNote: "Live provider today.",
  },
  {
    id: "originality",
    name: "Originality.ai",
    status: "candidate",
    trustNote: "Strong candidate for publisher/editorial use; recommended for a paid pilot.",
    usageNote: "Credit-based plans; API access is generally tied to higher/API-enabled plans.",
    minTextNote: "Should be validated with Indian Express headline/body samples before activation.",
    adminNote: "Candidate only until API credentials and adapter are connected.",
  },
  {
    id: "gptzero",
    name: "GPTZero",
    status: "candidate",
    trustNote: "Credible second candidate for benchmark testing against Originality.ai.",
    usageNote: "Plan-based word limits and overage pricing apply.",
    minTextNote: "Should be validated with newsroom samples before activation.",
    adminNote: "Candidate only until API credentials and adapter are connected.",
  },
];

export const SUPPORTED_AI_DETECTION_PROVIDERS = new Set<AiDetectionProviderId>(["copyleaks"]);

export function normalizeAiDetectionProvider(value: string | null | undefined): AiDetectionProviderId {
  return value === "originality" || value === "gptzero" || value === "copyleaks" ? value : "copyleaks";
}

export function getProviderProfile(id: AiDetectionProviderId) {
  return AI_DETECTION_PROVIDER_PROFILES.find((profile) => profile.id === id) ?? AI_DETECTION_PROVIDER_PROFILES[0];
}
