import { createServiceApp } from "@deliverhub/server-platform/http/create-service-app";
import { requireInternalEvent } from "@deliverhub/server-platform/messaging/event-bus";
import { errorHandler, notFoundMiddleware } from "../middlewares/error-handler.middleware.js";
import { receiveInternalEvent } from "../controllers/event.controller.js";
import { registerAdminRoutes } from "../routes/admin.routes.js";

export function createAdminServiceApp({ basePath = "/api/admin" } = {}) {
  const app = createServiceApp({
    serviceName: "admin-service",
    registerRoutes: (app) => {
      app.post("/internal/events", requireInternalEvent, receiveInternalEvent);
      registerAdminRoutes(app, { basePath });
    },
  });

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}

export default createAdminServiceApp;
