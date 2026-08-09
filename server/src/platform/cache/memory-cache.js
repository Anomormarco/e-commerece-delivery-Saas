import { redisClient } from "../redis/client.js";

const store = new Map();
const redisPrefix = process.env.REDIS_KEY_PREFIX ?? "deliverhub";

function isExpired(entry) {
  return entry.expiresAt <= Date.now();
}

function redisKey(key) {
  return `${redisPrefix}:cache:${key}`;
}

function serialize(value) {
  return JSON.stringify(value, (_key, nextValue) => (
    typeof nextValue === "bigint" ? { __bigint: nextValue.toString() } : nextValue
  ));
}

function deserialize(value) {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(value, (_key, nextValue) => (
    nextValue && typeof nextValue === "object" && "__bigint" in nextValue ? BigInt(nextValue.__bigint) : nextValue
  ));
}

export function createMemoryCache({ ttlMs = 15_000, maxEntries = 500 } = {}) {
  async function get(key) {
    if (redisClient) {
      return deserialize(await redisClient.get(redisKey(key)));
    }

    const entry = store.get(key);
    if (!entry) return undefined;

    if (isExpired(entry)) {
      store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  async function set(key, value, nextTtlMs = ttlMs) {
    if (redisClient) {
      await redisClient.set(redisKey(key), serialize(value), nextTtlMs);
      return value;
    }

    if (store.size >= maxEntries) {
      const firstKey = store.keys().next().value;
      if (firstKey) store.delete(firstKey);
    }

    store.set(key, {
      value,
      expiresAt: Date.now() + nextTtlMs,
    });
    return value;
  }

  async function remember(key, loader, nextTtlMs = ttlMs) {
    const cached = await get(key);
    if (cached !== undefined) return cached;
    return set(key, await loader(), nextTtlMs);
  }

  async function del(key) {
    if (redisClient) {
      await redisClient.del(redisKey(key));
      return;
    }

    store.delete(key);
  }

  async function clearByPrefix(prefix) {
    if (redisClient) {
      const keys = await redisClient.keys(redisKey(`${prefix}*`));
      if (typeof keys === "string") return;
      await redisClient.del(...keys);
      return;
    }

    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  async function clear() {
    if (redisClient) {
      const keys = await redisClient.keys(redisKey("*"));
      if (typeof keys !== "string") await redisClient.del(...keys);
      return;
    }

    store.clear();
  }

  return { clear, clearByPrefix, del, get, remember, set };
}

export const appCache = createMemoryCache();
