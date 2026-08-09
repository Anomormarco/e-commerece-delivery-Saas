function statusCodeFromError(error) {
  const statusCode = Number(error?.statusCode ?? error?.status);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
}

function codeFromStatus(statusCode) {
  if (statusCode === 400) return "BAD_REQUEST";
  if (statusCode === 401) return "UNAUTHENTICATED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 422) return "VALIDATION_ERROR";
  return "INTERNAL_SERVER_ERROR";
}

function defaultMessageFromCode(code, statusCode) {
  if (code === "INVALID_TOKEN") return "Нэвтрэх token буруу байна.";
  if (code === "TOKEN_EXPIRED") return "Нэвтрэх хугацаа дууссан байна.";
  if (code === "UNAUTHENTICATED") return "Нэвтрэх шаардлагатай.";
  if (code === "FORBIDDEN") return "Энэ үйлдлийг хийх эрхгүй байна.";
  if (code === "NOT_FOUND") return "Хүссэн мэдээлэл олдсонгүй.";
  if (code === "CONFLICT") return "Өгөгдлийн зөрчил гарлаа.";
  if (code === "VALIDATION_ERROR") return "Оруулсан мэдээллээ шалгана уу.";
  if (code === "BAD_REQUEST") return "Хүсэлтийн мэдээлэл буруу байна.";
  if (statusCode >= 500) return "Сервер дээр алдаа гарлаа. Дахин оролдоно уу.";
  return "Хүсэлтийг боловсруулахад алдаа гарлаа.";
}

function messageFromError(error, code, statusCode, isOperational) {
  if (!isOperational) return defaultMessageFromCode(code, statusCode);
  return /[\u0400-\u04FF]/.test(error.message ?? "") ? error.message : defaultMessageFromCode(code, statusCode);
}

export function notFoundMiddleware(request, _response, next) {
  const error = new Error("Хүссэн API зам олдсонгүй.");
  error.statusCode = 404;
  error.code = "NOT_FOUND";
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = statusCodeFromError(error);
  const isOperational = statusCode < 500;
  const code = error.code ?? codeFromStatus(statusCode);

  if (!isOperational) console.error(error);

  response.status(statusCode).json({
    status: "error",
    statusCode,
    message: messageFromError(error, code, statusCode, isOperational),
    code,
    service: "store-service",
  });
}
