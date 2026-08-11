import { asyncHandler } from "../controllers/async-handler.js";
import { listStoreNotifications, markStoreNotificationsRead } from "../controllers/notification.controller.js";
import { acceptOrder, createStoreDeliveryRequest, markOrderPrepared, showStoreDashboard, verifyPickup } from "../controllers/store.controller.js";

export function registerStoreRoutes(app, { basePath = "/api/store" } = {}) {
  app.get(`${basePath}/dashboard`, asyncHandler(showStoreDashboard));
  app.get(`${basePath}/notifications`, asyncHandler(listStoreNotifications));
  app.post(`${basePath}/notifications/read`, asyncHandler(markStoreNotificationsRead));
  app.post(`${basePath}/orders/:orderId/accept`, asyncHandler(acceptOrder));
  app.post(`${basePath}/orders/:orderId/prepared`, asyncHandler(markOrderPrepared));
  app.post(`${basePath}/assignments/:assignmentId/verify-pickup`, asyncHandler(verifyPickup));
  app.post(`${basePath}/dispatch-request`, asyncHandler(createStoreDeliveryRequest));
}
