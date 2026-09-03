import { asyncHandler } from "../controllers/async-handler.js";
import {
  activateAllSubscriptions,
  createEmployee,
  createStore,
  deleteEmployee,
  deleteStore,
  extendStoreSubscription,
  loginAdmin,
  logoutAdmin,
  registerAdmin,
  showAdminDashboard,
  showAdminSession,
  updateEmployee,
  updateAdminProfile,
  updateStore,
} from "../controllers/admin.controller.js";
import { listAdminNotifications, markAdminNotificationsRead } from "../controllers/notification.controller.js";
import { requirePlatformAdmin } from "../services/admin-auth.service.js";

export function registerAdminRoutes(app, { basePath = "/api/admin" } = {}) {
  app.post(`${basePath}/auth/register`, asyncHandler(registerAdmin));
  app.post(`${basePath}/auth/login`, asyncHandler(loginAdmin));
  app.get(`${basePath}/auth/me`, asyncHandler(showAdminSession));
  app.post(`${basePath}/auth/logout`, asyncHandler(logoutAdmin));
  app.post(`${basePath}/auth/profile`, asyncHandler(updateAdminProfile));
  app.get(`${basePath}/dashboard`, asyncHandler(requirePlatformAdmin(showAdminDashboard)));
  app.post(`${basePath}/stores/activate-all`, asyncHandler(requirePlatformAdmin(activateAllSubscriptions)));
  app.post(`${basePath}/stores`, asyncHandler(requirePlatformAdmin(createStore)));
  app.post(`${basePath}/stores/:storeId/subscription`, asyncHandler(requirePlatformAdmin(extendStoreSubscription)));
  app.post(`${basePath}/stores/:storeId/delete`, asyncHandler(requirePlatformAdmin(deleteStore)));
  app.post(`${basePath}/stores/:storeId`, asyncHandler(requirePlatformAdmin(updateStore)));
  app.post(`${basePath}/employees`, asyncHandler(requirePlatformAdmin(createEmployee)));
  app.post(`${basePath}/employees/:userId/delete`, asyncHandler(requirePlatformAdmin(deleteEmployee)));
  app.post(`${basePath}/employees/:userId`, asyncHandler(requirePlatformAdmin(updateEmployee)));
  app.get(`${basePath}/notifications`, asyncHandler(requirePlatformAdmin(listAdminNotifications)));
  app.post(`${basePath}/notifications/read`, asyncHandler(requirePlatformAdmin(markAdminNotificationsRead)));
}
