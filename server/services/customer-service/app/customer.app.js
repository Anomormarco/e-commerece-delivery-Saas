import { createServiceApp } from "@deliverhub/server-platform/http/create-service-app";
import { requireInternalEvent } from "@deliverhub/server-platform/messaging/event-bus";
import { optionalAuth } from "../middlewares/auth.middleware.js";
import { errorHandler, notFoundMiddleware } from "../middlewares/error-handler.middleware.js";
import { receiveInternalEvent } from "../controllers/event.controller.js";
import { registerCustomerRoutes } from "../routes/customer.routes.js";

export function createCustomerServiceApp({ basePath = "/api/customer" } = {}) {
  const app = createServiceApp({
    serviceName: "customer-service",
    registerRoutes: (app) => {
      app.post("/internal/events", requireInternalEvent, receiveInternalEvent);
      app.use(optionalAuth);
      registerCustomerRoutes(app, { basePath });
    },
  });

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}

export default createCustomerServiceApp;
