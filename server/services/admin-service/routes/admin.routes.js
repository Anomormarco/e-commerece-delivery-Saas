import { asyncHandler } from "../controllers/async-handler.js";
import {
  deleteEmployee,
  deleteStore,
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
  app.post(`${basePath}/stores/:storeId`, asyncHandler(requirePlatformAdmin(updateStore)));
  app.post(`${basePath}/stores/:storeId/delete`, asyncHandler(requirePlatformAdmin(deleteStore)));
  app.post(`${basePath}/employees/:userId`, asyncHandler(requirePlatformAdmin(updateEmployee)));
  app.post(`${basePath}/employees/:userId/delete`, asyncHandler(requirePlatformAdmin(deleteEmployee)));
  app.get(`${basePath}/notifications`, asyncHandler(requirePlatformAdmin(listAdminNotifications)));
  app.post(`${basePath}/notifications/read`, asyncHandler(requirePlatformAdmin(markAdminNotificationsRead)));
}
