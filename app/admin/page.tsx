import { Header } from "../ui/header";
import { getCurrentUser, isAdmin } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { ADMIN_EMAILS } from "../../lib/auth-options";
import { getApprovedUserEmails } from "../../lib/access-policy";
import { addApprovedUser, removeApprovedUser } from "./access-actions";
import { updateAiDetectionProvider } from "./ai-detection-actions";
import { isAccessEmailConfigured } from "../../lib/access-email";
import {
  AI_DETECTION_PROVIDER_PROFILES,
  AI_DETECTION_PROVIDER_SETTING_KEY,
  SUPPORTED_AI_DETECTION_PROVIDERS,
  getProviderProfile,
  normalizeAiDetectionProvider,
} from "../../lib/ai-detection-providers";
import { RecentUsageTable, UserActivityTable } from "./admin-tables";

export const dynamic = "force-dynamic";

type RecentCheck = {
  id: string;
  userId: string;
  publication: string;
  status: "SUCCEEDED" | "FAILED";
  failureCategory: string | null;
  wordCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  aiDetectionScore: number | null;
  aiDetectionPassed: boolean | null;
  aiHeadlineScore: number | null;
  aiBodyScore: number | null;
  aiDetectionThreshold: number | null;
  cviVerdict: string | null;
  cviAction: string | null;
  createdAt: Date;
  user: { email: string };
};

export default async function Admin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return (
      <>
        <Header active="admin" />
        <main className="blocked card">
          <p className="eyebrow">ACCESS CONTROLLED</p>
          <h1>Administrator access required.</h1>
          <p>
            This page contains operational metadata and provider configuration. Sign in with an
            approved administrator account.
          </p>
          <a className="button" href="/auth/signin">
            Sign in
          </a>
        </main>
      </>
    );
  }

  // Dynamic server route: the reporting window intentionally uses request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [
    checks,
    active,
    successful,
    tokenUsage,
    recent,
    runsByUser,
    authActivity,
    approvedUsers,
    aiScans,
    aiWarnings,
    aiScores,
    aiProviderUsage,
    activeDetectorSetting,
  ] = await Promise.all([
    prisma.checkMetadata.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { checks: { some: { createdAt: { gte: since } } } } }),
    prisma.checkMetadata.count({ where: { createdAt: { gte: since }, status: "SUCCEEDED" } }),
    prisma.checkMetadata.aggregate({
      where: { createdAt: { gte: since }, status: "SUCCEEDED" },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.checkMetadata.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        publication: true,
        status: true,
        failureCategory: true,
        wordCount: true,
        inputTokens: true,
        outputTokens: true,
        aiDetectionScore: true,
        aiDetectionPassed: true,
        aiHeadlineScore: true,
        aiBodyScore: true,
        aiDetectionThreshold: true,
        cviVerdict: true,
        cviAction: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.checkMetadata.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.auditEvent.findMany({
      where: { event: { in: ["auth.sign_in", "auth.sign_out"] } },
      orderBy: { createdAt: "desc" },
    }),
    getApprovedUserEmails(),
    prisma.checkMetadata.count({
      where: { createdAt: { gte: since }, aiDetectionScore: { not: null } },
    }),
    prisma.checkMetadata.count({ where: { createdAt: { gte: since }, cviVerdict: "WARNING" } }),
    prisma.checkMetadata.aggregate({
      where: { createdAt: { gte: since }, aiDetectionScore: { not: null } },
      _avg: { aiDetectionScore: true },
    }),
    prisma.checkMetadata.groupBy({
      by: ["aiDetectionProvider"],
      where: { createdAt: { gte: since }, aiDetectionProvider: { not: null } },
      _count: { _all: true },
    }),
    prisma.setting.findUnique({ where: { key: AI_DETECTION_PROVIDER_SETTING_KEY } }),
  ]);

  const actorIds = authActivity.flatMap((item) => (item.actorId ? [item.actorId] : []));
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true },
      })
    : [];
  const actorEmails = new Map(actors.map((actor) => [actor.id, actor.email]));
  const runCounts = new Map(runsByUser.map((item) => [item.userId, item._count._all]));
  const tokensUsed = (tokenUsage._sum.inputTokens ?? 0) + (tokenUsage._sum.outputTokens ?? 0);
  const estimatedCostInr = calculateClaudeSonnetCostInr(
    tokenUsage._sum.inputTokens ?? 0,
    tokenUsage._sum.outputTokens ?? 0,
  );
  const activeDetector = normalizeAiDetectionProvider(activeDetectorSetting?.publicValue);
  const activeDetectorProfile = getProviderProfile(activeDetector);
  const providerUsageRows = aiProviderUsage.map((item) => ({
    provider: item.aiDetectionProvider ?? "unknown",
    checks: item._count._all,
  }));
  const metrics = [
    ["CHECKS RUN", String(checks), "All attempts · 30 days"],
    ["ARTICLES OPTIMISED", String(successful), "Successful checks · 30 days"],
    ["ACTIVE JOURNALISTS", String(active), "Unique employee accounts"],
    ["TOTAL API TOKENS USED", formatTokens(tokensUsed), "Recorded input + output · 30 days"],
    [
      "TOTAL EST. COST (₹)",
      `₹${estimatedCostInr.toFixed(2)}`,
      "Claude Sonnet actual input/output · ₹95/$",
    ],
    ["CVI SCANS", String(aiScans), "Headline + body checks · 30 days"],
    ["CVI WARNINGS", String(aiWarnings), "20% or higher · journalist choice"],
    [
      "AVG CVI ESTIMATE",
      `${(aiScores._avg.aiDetectionScore ?? 0).toFixed(1)}%`,
      "Detection estimate · 30 days",
    ],
  ];
  const progressByCheckId = buildProgressMap(recent, runCounts);
  const recentRows = recent.map((item) => ({
    id: item.id,
    userId: item.user.email,
    publication: item.publication,
    checkedOn: formatActivityTime(item.createdAt),
    status: item.status.toLowerCase(),
    reason:
      item.cviVerdict === "WARNING"
        ? `CVI warning H ${(item.aiHeadlineScore ?? 0).toFixed(1)}% / B ${(item.aiBodyScore ?? 0).toFixed(1)}% · ${item.cviAction === "CONTEST" ? "Contested" : "Proceeded"}`
        : item.status === "FAILED"
          ? (item.failureCategory ?? "-")
          : item.aiDetectionScore !== null
            ? `CVI ${(item.aiDetectionScore ?? 0).toFixed(1)}% · Completed`
            : "Completed",
    runs: progressByCheckId.get(item.id) ?? `1/${runCounts.get(item.userId) ?? 1}`,
    words: item.wordCount.toLocaleString("en-IN"),
    cost: `₹${calculateClaudeSonnetCostInr(item.inputTokens ?? 0, item.outputTokens ?? 0).toFixed(2)}`,
  }));
  const activityRows = authActivity.map((item) => {
    const email = item.actorId ? (actorEmails.get(item.actorId) ?? "Unknown user") : "Unknown user";
    return {
      id: item.id,
      userId: email,
      role: ADMIN_EMAILS.has(email.toLowerCase()) ? "Admin" : "User",
      activity: item.event === "auth.sign_in" ? "Login" : "Logout",
      dateTime: formatActivityTime(item.createdAt),
    };
  });

  return (
    <>
      <Header active="admin" />
      <main className="page">
        <section className="page-head">
          <p className="eyebrow">DCT AI INDEPENDENT — DIGITAL COACHING TOOL · CONTROL ROOM</p>
          <h1>Editorial quality, adoption and security in one view.</h1>
          <p>Article drafts, prompts and model outputs are excluded from analytics storage.</p>
        </section>
        <section className="metrics admin-metrics">
          {metrics.map((metric) => (
            <article className="card metric" key={metric[0]}>
              <p className="eyebrow">{metric[0]}</p>
              <strong>{metric[1]}</strong>
              <span>{metric[2]}</span>
            </article>
          ))}
        </section>
        <section className="admin-grid">
          <div className="admin-table-pair">
            <AdminCard title="Recent usage">
              <RecentUsageTable rows={recentRows} />
            </AdminCard>
            <AdminCard title="User Activity">
              <UserActivityTable rows={activityRows} />
            </AdminCard>
          </div>
          <AdminCard title="Security and system health" compact>
            <ul className="health">
              <li>PostgreSQL metadata and audit storage connected</li>
              <li>Provider credentials remain server-side</li>
              <li>CVI warning gate keeps provider credentials server-side</li>
              <li>Server-side access policy active</li>
              <li>Prompt checksum locked</li>
            </ul>
          </AdminCard>
          <AdminCard title="Engine and cost controls" compact>
            <p>CVI: headline and body checked independently · warning at 20%</p>
            <p>Editorial engine: Anthropic · Model: Claude Sonnet 4.6</p>
            <p>Cost display: $3/MTok input + $15/MTok output · ₹95/$</p>
            <p>Per-user limit: 5 checks / 15 minutes · Organisation safety limit: 500/day</p>
          </AdminCard>
          <AdminCard title="AI detection provider control" compact>
            <p>
              <b>Live provider:</b> {activeDetectorProfile.name}
            </p>
            <p>
              Provider choice is admin-only. Journalists see only the CVI estimate and warning
              state, not the detector brand.
            </p>
            <form className="detector-control" action={updateAiDetectionProvider}>
              <label>
                Active detector for users
                <select name="provider" defaultValue={activeDetector}>
                  {AI_DETECTION_PROVIDER_PROFILES.map((profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                      disabled={!SUPPORTED_AI_DETECTION_PROVIDERS.has(profile.id)}
                    >
                      {profile.name}
                      {SUPPORTED_AI_DETECTION_PROVIDERS.has(profile.id) ? "" : " — not connected"}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Save detector</button>
            </form>
            <div className="detector-list">
              {AI_DETECTION_PROVIDER_PROFILES.map((profile) => (
                <div key={profile.id}>
                  <strong>{profile.name}</strong>
                  <span>{profile.adminNote}</span>
                  <small>{profile.usageNote}</small>
                  <small>{profile.minTextNote}</small>
                </div>
              ))}
            </div>
            <div className="detector-usage">
              <b>30-day usage by detector</b>
              {providerUsageRows.length ? (
                providerUsageRows.map((row) => (
                  <span key={row.provider}>
                    {row.provider}: {row.checks.toLocaleString("en-IN")} scans
                  </span>
                ))
              ) : (
                <span>No detector scans recorded yet.</span>
              )}
            </div>
          </AdminCard>
          <AdminCard title="Knowledge-base register" compact>
            <p>
              <b>8 active records</b>
            </p>
            <p>
              Master prompt and seven active knowledge documents are checksum-locked. Four legacy
              documents remain isolated in the archive.
            </p>
          </AdminCard>
          <AdminCard title="User access" compact>
            <p>
              All verified @indianexpress.com and @expressindia.com accounts are allowed
              automatically. Add individual Gmail or other email addresses below for anyone outside
              those domains.
            </p>
            {approvedUsers.length ? (
              <p className={`mail-status ${isAccessEmailConfigured() ? "ready" : "pending"}`}>
                <b>Access email:</b>{" "}
                {isAccessEmailConfigured()
                  ? "Ready — sent once after every user's first successful login."
                  : "Delivery service configuration required."}
              </p>
            ) : null}
            <form className="access-add" action={addApprovedUser}>
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                />
              </label>
              <button type="submit">Add user</button>
            </form>
            {approvedUsers.length ? (
              <div className="access-list">
                {approvedUsers.map((email) => (
                  <div key={email}>
                    <span>{email}</span>
                    <form action={removeApprovedUser.bind(null, email)}>
                      <button type="submit">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p>No individually approved email addresses yet.</p>
            )}
          </AdminCard>
        </section>
      </main>
    </>
  );
}

function AdminCard({
  title,
  children,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <article className={`card admin-card${compact ? " compact" : ""}`}>
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function buildProgressMap(recent: RecentCheck[], runCounts: Map<string, number>) {
  const progressByCheckId = new Map<string, string>();
  const checksByUser = new Map<string, RecentCheck[]>();
  for (const item of [...recent].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const items = checksByUser.get(item.userId) ?? [];
    items.push(item);
    checksByUser.set(item.userId, items);
  }
  for (const [userId, items] of checksByUser) {
    const total = runCounts.get(userId) ?? items.length;
    items.forEach((item, index) => {
      progressByCheckId.set(item.id, `${index + 1}/${total}`);
    });
  }
  return progressByCheckId;
}

function formatTokens(tokens: number) {
  return tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}K` : String(tokens);
}

function formatActivityTime(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function calculateClaudeSonnetCostInr(inputTokens: number, outputTokens: number) {
  return ((inputTokens * 3 + outputTokens * 15) / 1_000_000) * 95;
}
