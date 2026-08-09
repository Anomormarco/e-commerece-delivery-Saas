import { asyncHandler } from "../controllers/async-handler.js";
import {
  loginAdmin,
  logoutAdmin,
  registerAdmin,
  showAdminDashboard,
  showAdminSession,
  updateAdminProfile,
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
  app.get(`${basePath}/notifications`, asyncHandler(listAdminNotifications));
  app.post(`${basePath}/notifications/read`, asyncHandler(markAdminNotificationsRead));
}
