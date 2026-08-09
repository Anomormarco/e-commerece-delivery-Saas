import { createHmac, timingSafeEqual } from "node:crypto";

const defaultExpiresInSeconds = 60 * 60 * 8;
const devJwtSecret = "deliverhub-local-dev-secret-change-me";

function jwtSecret() {
  const secret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : devJwtSecret);

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function decodeBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function invalidTokenError(message = "Invalid token", code = "INVALID_TOKEN") {
  return Object.assign(new Error(message), { statusCode: 401, code });
}

function sign(input, secret = jwtSecret()) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signJwt(payload, { expiresInSeconds = defaultExpiresInSeconds } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(body)}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = String(token ?? "").split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw invalidTokenError();
  }

  let header;
  let payload;

  try {
    header = decodeBase64UrlJson(encodedHeader);
    payload = decodeBase64UrlJson(encodedPayload);
  } catch {
    throw invalidTokenError();
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw invalidTokenError("Unsupported token");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  if (!safeEqual(signature, expectedSignature)) {
    throw invalidTokenError("Invalid token signature");
  }

  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw invalidTokenError("Token expired", "TOKEN_EXPIRED");
  }

  return payload;
}
