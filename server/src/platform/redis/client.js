import net from "node:net";
import tls from "node:tls";

function encodeCommand(parts) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join("")}`;
}

function parseOne(text, offset = 0) {
  const type = text[offset];
  const lineEnd = text.indexOf("\r\n", offset);
  const header = text.slice(offset + 1, lineEnd);
  const nextOffset = lineEnd + 2;

  if (type === "+") return { value: header, offset: nextOffset };
  if (type === ":") return { value: Number(header), offset: nextOffset };
  if (type === "-") throw new Error(header);
  if (type === "$") {
    const length = Number(header);
    if (length === -1) return { value: null, offset: nextOffset };
    return {
      value: text.slice(nextOffset, nextOffset + length),
      offset: nextOffset + length + 2,
    };
  }
  if (type === "*") {
    const count = Number(header);
    const values = [];
    let currentOffset = nextOffset;
    for (let index = 0; index < count; index += 1) {
      const item = parseOne(text, currentOffset);
      values.push(item.value);
      currentOffset = item.offset;
    }
    return { value: values, offset: currentOffset };
  }

  return { value: text.slice(offset), offset: text.length };
}

function parseResp(buffer) {
  const text = buffer.toString("utf8");
  let offset = 0;
  let value = null;

  while (offset < text.length) {
    const parsed = parseOne(text, offset);
    value = parsed.value;
    offset = parsed.offset;
  }

  return value;
}

function redisOptionsFromUrl(redisUrl) {
  const url = new URL(redisUrl);
  return {
    db: url.pathname?.slice(1),
    host: url.hostname,
    password: url.password ? decodeURIComponent(url.password) : "",
    port: Number(url.port || 6379),
    tls: url.protocol === "rediss:",
    username: url.username ? decodeURIComponent(url.username) : "",
  };
}

export function hasRedisUrl() {
  return Boolean(process.env.REDIS_URL);
}

export function createRedisClient(redisUrl = process.env.REDIS_URL) {
  if (!redisUrl) return null;
  const options = redisOptionsFromUrl(redisUrl);

  function socketConnect() {
    return new Promise((resolve, reject) => {
      const socket = options.tls
        ? tls.connect({ host: options.host, port: options.port }, () => resolve(socket))
        : net.connect({ host: options.host, port: options.port }, () => resolve(socket));

      socket.setTimeout(Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 1500));
      socket.once("error", reject);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Redis command timeout"));
      });
    });
  }

  async function command(...parts) {
    const socket = await socketConnect();

    return new Promise((resolve, reject) => {
      const chunks = [];
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.once("error", reject);
      socket.once("end", () => {
        try {
          resolve(parseResp(Buffer.concat(chunks)));
        } catch (error) {
          reject(error);
        }
      });

      const commands = [];
      if (options.password) {
        commands.push(options.username ? ["AUTH", options.username, options.password] : ["AUTH", options.password]);
      }
      if (options.db) {
        commands.push(["SELECT", options.db]);
      }
      commands.push(parts);

      socket.write(commands.map(encodeCommand).join(""), () => socket.end());
    });
  }

  return {
    command,
    del: (...keys) => keys.length ? command("DEL", ...keys) : Promise.resolve(0),
    expire: (key, seconds) => command("EXPIRE", key, seconds),
    get: (key) => command("GET", key),
    incr: (key) => command("INCR", key),
    keys: (pattern) => command("KEYS", pattern),
    ping: () => command("PING"),
    publish: (channel, message) => command("PUBLISH", channel, message),
    set: (key, value, ttlMs) => ttlMs ? command("SET", key, value, "PX", ttlMs) : command("SET", key, value),
  };
}

export const redisClient = createRedisClient();
