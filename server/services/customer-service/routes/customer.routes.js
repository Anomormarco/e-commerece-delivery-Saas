import { asyncHandler } from "../controllers/async-handler.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  checkQpayPayment,
  createOrder,
  listOrderHistory,
  listStores,
  login,
  register,
  showCurrentCustomerTracking,
} from "../controllers/customer.controller.js";
import { listCustomerNotifications, markCustomerNotificationsRead } from "../controllers/notification.controller.js";

export function registerCustomerRoutes(app, { basePath = "/api/customer" } = {}) {
  app.post(`${basePath}/auth/register`, asyncHandler(register));
  app.post(`${basePath}/auth/login`, asyncHandler(login));
  // Public: browsing the market never requires login. Only checkout does.
  app.get(`${basePath}/stores`, asyncHandler(listStores));
  app.post(`${basePath}/orders`, requireAuth, asyncHandler(createOrder));
  app.post(`${basePath}/payments/qpay/callback`, asyncHandler(checkQpayPayment));
  app.post(`${basePath}/payments/qpay/check`, requireAuth, asyncHandler(checkQpayPayment));
  app.get(`${basePath}/orders/history`, requireAuth, asyncHandler(listOrderHistory));
  app.get(`${basePath}/orders/current/tracking`, requireAuth, asyncHandler(showCurrentCustomerTracking));
  app.get(`${basePath}/notifications`, requireAuth, asyncHandler(listCustomerNotifications));
  app.post(`${basePath}/notifications/read`, requireAuth, asyncHandler(markCustomerNotificationsRead));
}
