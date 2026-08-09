import { redisClient } from "@deliverhub/server-platform/redis/client";

const buckets = new Map();
const redisPrefix = process.env.REDIS_KEY_PREFIX ?? "deliverhub";

function clientKey(request) {
  const forwardedFor = request.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.ip || request.socket.remoteAddress || "unknown";
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function redisHit(key, windowMs) {
  const redisKey = `${redisPrefix}:rate:${key}`;
  const count = Number(await redisClient.incr(redisKey));
  if (count === 1) {
    await redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
  }
  return count;
}

function memoryHit(key, windowMs) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  current.count += 1;
  return {
    count: current.count,
    retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function rateLimitMiddleware({
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
} = {}) {
  return async (request, response, next) => {
    try {
      const key = `${clientKey(request)}:${request.method}:${request.path}`;
      const result = redisClient
        ? { count: await redisHit(key, windowMs), retryAfterSeconds: Math.ceil(windowMs / 1000) }
        : memoryHit(key, windowMs);

      const remaining = Math.max(maxRequests - result.count, 0);
      response.header("X-RateLimit-Limit", String(maxRequests));
      response.header("X-RateLimit-Remaining", String(remaining));
      response.header("Retry-After", String(result.retryAfterSeconds));

      if (result.count > maxRequests) {
        next(createHttpError(429, "Хэт олон хүсэлт илгээгдлээ. Түр хүлээгээд дахин оролдоно уу.", "RATE_LIMITED"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
