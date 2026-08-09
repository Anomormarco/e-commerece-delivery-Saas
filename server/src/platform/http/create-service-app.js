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

export function createServiceApp({ serviceName, registerRoutes }) {
  const app = express();

  process.env.SERVICE_NAME = serviceName;
  app.use(requestLogger(serviceName));
  app.use(metricsMiddleware());
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
