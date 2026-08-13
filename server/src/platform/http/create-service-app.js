import express from "express";
import { requestLogger } from "../observability/logger.js";
import { metricsMiddleware, metricsText } from "../observability/metrics.js";

function corsMiddleware(request, response, next) {
  const origin = request.header("origin");

  if (origin) {
    response.header("Access-Control-Allow-Origin", origin);
    response.header("Vary", "Origin");
  }

  response.header("Access-Control-Allow-Credentials", "true");
  response.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, x-tenant-id, x-user-id, x-role");
  response.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
}

function securityHeadersMiddleware(request, response, next) {
  const forwardedProto = request.header("x-forwarded-proto");
  const shouldRedirectToHttps = process.env.NODE_ENV === "production"
    && forwardedProto
    && forwardedProto !== "https";

  if (shouldRedirectToHttps) {
    response.redirect(308, `https://${request.header("host")}${request.originalUrl}`);
    return;
  }

  response.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.header("X-Content-Type-Options", "nosniff");
  response.header("Referrer-Policy", "strict-origin-when-cross-origin");
  response.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  response.header("X-Frame-Options", "DENY");
  next();
}

export function createServiceApp({ serviceName, registerRoutes }) {
  const app = express();

  app.set("trust proxy", 1);
  process.env.SERVICE_NAME = serviceName;
  app.use(requestLogger(serviceName));
  app.use(metricsMiddleware());
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: serviceName });
  });

  app.get("/metrics", (_request, response) => {
    response.type("text/plain").send(metricsText(serviceName));
  });

  registerRoutes(app);

  return app;
}
