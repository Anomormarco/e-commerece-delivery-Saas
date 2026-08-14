import { asyncHandler } from "../controllers/async-handler.js";
import { listStoreNotifications, markStoreNotificationsRead } from "../controllers/notification.controller.js";
import {
  acceptOrder,
  checkSubscriptionPayment,
  createStoreDeliveryRequest,
  createSubscriptionInvoice,
  loginStore,
  markOrderPrepared,
  registerStore,
  showStoreDashboard,
  showStoreSubscription,
  verifyPickup,
} from "../controllers/store.controller.js";

export function registerStoreRoutes(app, { basePath = "/api/store" } = {}) {
  app.post(`${basePath}/auth/register`, asyncHandler(registerStore));
  app.post(`${basePath}/auth/login`, asyncHandler(loginStore));
  app.get(`${basePath}/dashboard`, asyncHandler(showStoreDashboard));
  app.get(`${basePath}/subscription`, asyncHandler(showStoreSubscription));
  app.post(`${basePath}/subscription/qpay/invoice`, asyncHandler(createSubscriptionInvoice));
  app.post(`${basePath}/subscription/qpay/check`, asyncHandler(checkSubscriptionPayment));
  app.get(`${basePath}/notifications`, asyncHandler(listStoreNotifications));
  app.post(`${basePath}/notifications/read`, asyncHandler(markStoreNotificationsRead));
  app.post(`${basePath}/orders/:orderId/accept`, asyncHandler(acceptOrder));
  app.post(`${basePath}/orders/:orderId/prepared`, asyncHandler(markOrderPrepared));
  app.post(`${basePath}/assignments/:assignmentId/verify-pickup`, asyncHandler(verifyPickup));
  app.post(`${basePath}/dispatch-request`, asyncHandler(createStoreDeliveryRequest));
}
