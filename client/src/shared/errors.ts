type ApiErrorBody = {
  code?: string;
  message?: string;
  statusCode?: number;
};

const messagesByCode: Record<string, string> = {
  BAD_REQUEST: "Хүсэлтийн мэдээлэл буруу байна.",
  CONFLICT: "Өгөгдлийн зөрчил гарлаа.",
  FORBIDDEN: "Энэ үйлдлийг хийх эрхгүй байна.",
  INTERNAL_SERVER_ERROR: "Сервер дээр алдаа гарлаа. Дахин оролдоно уу.",
  INVALID_TOKEN: "Нэвтрэх token буруу байна. Дахин нэвтэрнэ үү.",
  NETWORK_ERROR: "Сервертэй холбогдож чадсангүй. Local server-үүд ассан эсэхийг шалгана уу.",
  NOT_FOUND: "Хүссэн мэдээлэл олдсонгүй.",
  RATE_LIMITED: "Хэт олон хүсэлт илгээгдлээ. Түр хүлээгээд дахин оролдоно уу.",
  TOKEN_EXPIRED: "Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.",
  UNAUTHENTICATED: "Нэвтрэх шаардлагатай.",
  VALIDATION_ERROR: "Оруулсан мэдээллээ шалгана уу.",
};

const messagesByStatus: Record<number, string> = {
  400: messagesByCode.BAD_REQUEST,
  401: messagesByCode.UNAUTHENTICATED,
  403: messagesByCode.FORBIDDEN,
  404: messagesByCode.NOT_FOUND,
  409: messagesByCode.CONFLICT,
  422: messagesByCode.VALIDATION_ERROR,
  429: messagesByCode.RATE_LIMITED,
  500: messagesByCode.INTERNAL_SERVER_ERROR,
};

function hasMongolianText(message = "") {
  return /[\u0400-\u04FF]/.test(message);
}

export function apiErrorMessage(body: ApiErrorBody | null, responseStatusCode: number) {
  const statusCode = body?.statusCode ?? responseStatusCode;
  const code = body?.code ?? "";
  const message = body?.message?.trim() ?? "";
  if (hasMongolianText(message)) return `${statusCode}: ${message}`;
  const translated = code && messagesByCode[code]
    ? messagesByCode[code]
    : hasMongolianText(message)
      ? message
      : messagesByStatus[statusCode] ?? "Хүсэлтийг боловсруулахад алдаа гарлаа.";

  return `${statusCode}: ${translated}`;
}

export function normalizeErrorMessage(error: unknown, fallback = "Алдаа гарлаа. Дахин оролдоно уу.") {
  if (!(error instanceof Error)) return fallback;
  if (error.message === "Failed to fetch") return messagesByCode.NETWORK_ERROR;
  if (error.message === "Load failed") return "Серверээс мэдээлэл татаж чадсангүй.";
  return hasMongolianText(error.message) ? error.message : fallback;
}
