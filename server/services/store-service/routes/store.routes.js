import { asyncHandler } from "../controllers/async-handler.js";
import { listStoreNotifications, markStoreNotificationsRead } from "../controllers/notification.controller.js";
import { createStoreDeliveryRequest, showStoreDashboard } from "../controllers/store.controller.js";

export function registerStoreRoutes(app, { basePath = "/api/store" } = {}) {
  app.get(`${basePath}/dashboard`, asyncHandler(showStoreDashboard));
  app.get(`${basePath}/notifications`, asyncHandler(listStoreNotifications));
  app.post(`${basePath}/notifications/read`, asyncHandler(markStoreNotificationsRead));
  app.post(`${basePath}/dispatch-request`, asyncHandler(createStoreDeliveryRequest));
}
