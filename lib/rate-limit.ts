import { Redis } from "@upstash/redis";
import { prisma } from "./prisma";
const local = new Map<string, { count: number; expires: number }>();
function redisClient() { return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null; }
export async function enforceLimits(userId: string) {
  const redis = redisClient();
  const userLimit = Number(process.env.PER_USER_CHECK_LIMIT ?? 5);
  const dailyLimit = Number(process.env.ORGANISATION_DAILY_LIMIT ?? 500);
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      const now = new Date();
      const quarterHourAgo = new Date(now.getTime() - 900_000);
      const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
      const [perUser, daily] = await Promise.all([
        prisma.checkMetadata.count({ where: { userId, createdAt: { gte: quarterHourAgo } } }),
        prisma.checkMetadata.count({ where: { createdAt: { gte: startOfDay } } }),
      ]);
      return perUser < userLimit && daily < dailyLimit;
    }
    const now = Date.now(); const value = local.get(userId);
    const next = !value || value.expires <= now ? { count: 1, expires: now + 900_000 } : { ...value, count: value.count + 1 };
    local.set(userId, next); return next.count <= userLimit;
  }
  const slot = Math.floor(Date.now() / 900_000); const day = new Date().toISOString().slice(0, 10);
  const [perUser, daily] = await Promise.all([redis.incr(`dct:rate:${userId}:${slot}`), redis.incr(`dct:daily:${day}`)]);
  await Promise.all([redis.expire(`dct:rate:${userId}:${slot}`, 1_000), redis.expire(`dct:daily:${day}`, 172_800)]);
  return perUser <= userLimit && daily <= dailyLimit;
}
