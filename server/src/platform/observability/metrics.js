const metrics = {
  requestsTotal: 0,
  requestsByStatus: new Map(),
  totalDurationMs: 0,
  startedAt: Date.now(),
};

function statusBucket(statusCode) {
  if (statusCode >= 500) return "5xx";
  if (statusCode >= 400) return "4xx";
  if (statusCode >= 300) return "3xx";
  if (statusCode >= 200) return "2xx";
  return "1xx";
}

export function metricsMiddleware() {
  return (_request, response, next) => {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const bucket = statusBucket(response.statusCode);
      metrics.requestsTotal += 1;
      metrics.totalDurationMs += durationMs;
      metrics.requestsByStatus.set(bucket, (metrics.requestsByStatus.get(bucket) ?? 0) + 1);
    });

    next();
  };
}

export function metricsText(serviceName) {
  const avgDurationMs = metrics.requestsTotal ? metrics.totalDurationMs / metrics.requestsTotal : 0;
  const lines = [
    "# HELP deliverhub_uptime_seconds Service uptime in seconds",
    "# TYPE deliverhub_uptime_seconds gauge",
    `deliverhub_uptime_seconds{service="${serviceName}"} ${Math.round((Date.now() - metrics.startedAt) / 1000)}`,
    "# HELP deliverhub_http_requests_total Total HTTP requests",
    "# TYPE deliverhub_http_requests_total counter",
    `deliverhub_http_requests_total{service="${serviceName}"} ${metrics.requestsTotal}`,
    "# HELP deliverhub_http_request_duration_ms_avg Average HTTP request duration in milliseconds",
    "# TYPE deliverhub_http_request_duration_ms_avg gauge",
    `deliverhub_http_request_duration_ms_avg{service="${serviceName}"} ${avgDurationMs.toFixed(2)}`,
  ];

  for (const [bucket, count] of metrics.requestsByStatus.entries()) {
    lines.push(`deliverhub_http_requests_by_status_total{service="${serviceName}",status="${bucket}"} ${count}`);
  }

  return `${lines.join("\n")}\n`;
}
