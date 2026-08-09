function baseLog(level, message, fields = {}) {
  const payload = {
    level,
    message,
    service: process.env.SERVICE_NAME,
    time: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (message, fields) => baseLog("error", message, fields),
  info: (message, fields) => baseLog("info", message, fields),
  warn: (message, fields) => baseLog("warn", message, fields),
};

export function requestLogger(serviceName) {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info("http_request", {
        durationMs: Math.round(durationMs * 100) / 100,
        method: request.method,
        path: request.originalUrl,
        requestId: request.header("x-request-id") ?? "",
        service: serviceName,
        statusCode: response.statusCode,
      });
    });

    next();
  };
}
