import { asyncHandler } from "../controllers/async-handler.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createOrder,
  listStores,
  login,
  register,
  showCurrentCustomerTracking,
} from "../controllers/customer.controller.js";
import { listCustomerNotifications, markCustomerNotificationsRead } from "../controllers/notification.controller.js";

export function registerCustomerRoutes(app, { basePath = "/api/customer" } = {}) {
  app.post(`${basePath}/auth/register`, asyncHandler(register));
  app.post(`${basePath}/auth/login`, asyncHandler(login));
  app.get(`${basePath}/stores`, requireAuth, asyncHandler(listStores));
  app.post(`${basePath}/orders`, requireAuth, asyncHandler(createOrder));
  app.get(`${basePath}/orders/current/tracking`, requireAuth, asyncHandler(showCurrentCustomerTracking));
  app.get(`${basePath}/notifications`, asyncHandler(listCustomerNotifications));
  app.post(`${basePath}/notifications/read`, asyncHandler(markCustomerNotificationsRead));
}
