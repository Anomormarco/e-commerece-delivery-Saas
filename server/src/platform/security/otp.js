import { createHash, randomInt } from "node:crypto";

export function createSixDigitOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function otpMatches(value, hash) {
  return Boolean(value && hash && hashOtp(value) === hash);
}
