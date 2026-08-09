import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const passwordIterations = 120000;
const passwordKeyLength = 32;
const passwordDigest = "sha256";

export function normalizeGmailAddress(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isGmailAddress(value) {
  return /^[^\s@]+@gmail\.com$/i.test(String(value ?? "").trim());
}

export function normalizePhone(value) {
  return String(value ?? "").replace(/[^\d+]/g, "");
}

export function isPhoneNumber(value) {
  return /^\+?\d{8,15}$/.test(normalizePhone(value));
}

export function validateGmailAddress(value) {
  const email = normalizeGmailAddress(value);
  if (!isGmailAddress(email)) {
    const error = new Error("Нэвтрэх нэр Gmail хаяг байх ёстой. Жишээ: name@gmail.com");
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  return email;
}

export function normalizeCourierLoginId(value) {
  const loginId = String(value ?? "").trim();
  if (loginId.includes("@")) return validateGmailAddress(loginId);

  const phone = normalizePhone(loginId);
  if (!isPhoneNumber(phone)) {
    const error = new Error("Курьерийн ID утасны дугаар эсвэл Gmail хаяг байх ёстой.");
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return phone;
}

export function isStrongPassword(password) {
  const value = String(password ?? "");
  return (
    value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value)
  );
}

export function validateStrongPassword(password) {
  if (!isStrongPassword(password)) {
    const error = new Error("Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой.");
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return String(password);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, passwordIterations, passwordKeyLength, passwordDigest).toString("hex");
  return `pbkdf2$${passwordIterations}$${salt}$${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [algorithm, iterations, salt, storedHash] = passwordHash?.split("$") ?? [];

  if (algorithm !== "pbkdf2" || !iterations || !salt || !storedHash) {
    return passwordHash === password;
  }

  const candidate = pbkdf2Sync(password, salt, Number(iterations), passwordKeyLength, passwordDigest);
  const stored = Buffer.from(storedHash, "hex");

  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
