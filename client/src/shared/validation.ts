export function isGmailAddress(value: string) {
  return /^[^\s@]+@gmail\.com$/i.test(value.trim());
}

export function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isPhoneNumber(value: string) {
  return /^\+?\d{8,15}$/.test(value.replace(/[^\d+]/g, ""));
}

export function isCourierLoginId(value: string) {
  return value.includes("@") ? isGmailAddress(value) : isPhoneNumber(value);
}

export function hasLatinLetters(value: string) {
  return /[A-Za-z]/.test(value);
}

export function isMongolianText(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && /[А-Яа-яЁёӨөҮү]/.test(trimmed) && !hasLatinLetters(trimmed);
}

export function isStrongPassword(value: string) {
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}
