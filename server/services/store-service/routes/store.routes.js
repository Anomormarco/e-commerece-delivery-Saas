import { asyncHandler } from "../controllers/async-handler.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
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
  app.get(`${basePath}/dashboard`, requireAuth, asyncHandler(showStoreDashboard));
  app.get(`${basePath}/subscription`, requireAuth, asyncHandler(showStoreSubscription));
  app.post(`${basePath}/subscription/qpay/invoice`, requireAuth, asyncHandler(createSubscriptionInvoice));
  app.post(`${basePath}/subscription/qpay/check`, requireAuth, asyncHandler(checkSubscriptionPayment));
  app.get(`${basePath}/notifications`, requireAuth, asyncHandler(listStoreNotifications));
  app.post(`${basePath}/notifications/read`, requireAuth, asyncHandler(markStoreNotificationsRead));
  app.post(`${basePath}/orders/:orderId/accept`, requireAuth, asyncHandler(acceptOrder));
  app.post(`${basePath}/orders/:orderId/prepared`, requireAuth, asyncHandler(markOrderPrepared));
  app.post(`${basePath}/assignments/:assignmentId/verify-pickup`, requireAuth, asyncHandler(verifyPickup));
  app.post(`${basePath}/dispatch-request`, requireAuth, asyncHandler(createStoreDeliveryRequest));
}
