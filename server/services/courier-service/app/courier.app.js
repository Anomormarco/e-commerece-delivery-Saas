import { createServiceApp } from "@deliverhub/server-platform/http/create-service-app";
import { requireInternalEvent } from "@deliverhub/server-platform/messaging/event-bus";
import { receiveInternalEvent } from "../controllers/event.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";
import { errorHandler, notFoundMiddleware } from "../middlewares/error-handler.middleware.js";
import { registerCourierRoutes } from "../routes/courier.routes.js";

export function createCourierServiceApp({ basePath = "/api/courier" } = {}) {
  const app = createServiceApp({
    serviceName: "courier-service",
    registerRoutes: (app) => {
      app.post("/internal/events", requireInternalEvent, receiveInternalEvent);
      app.use(optionalAuth);
      registerCourierRoutes(app, { basePath });
    },
  });

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}

export default createCourierServiceApp;
