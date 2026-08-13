import { asyncHandler } from "../controllers/async-handler.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  acceptCourierAssignment,
  arriveCourierStore,
  loginCourierAccount,
  registerCourierAccount,
  rejectCourierAssignment,
  showCourierDashboard,
  updateCourierProfile,
  updateCourierPosition,
  updateCourierStatus,
  verifyCourierDropoff,
  verifyCourierFace,
  verifyCourierIdentity,
  verifyCourierPickup,
} from "../controllers/courier.controller.js";
import { listCourierNotifications, markCourierNotificationsRead } from "../controllers/notification.controller.js";

export function registerCourierRoutes(app, { basePath = "/api/courier" } = {}) {
  app.post(`${basePath}/auth/register`, asyncHandler(registerCourierAccount));
  app.post(`${basePath}/auth/login`, asyncHandler(loginCourierAccount));
  app.get(`${basePath}/dashboard`, requireAuth, asyncHandler(showCourierDashboard));
  app.get(`${basePath}/notifications`, requireAuth, asyncHandler(listCourierNotifications));
  app.post(`${basePath}/notifications/read`, requireAuth, asyncHandler(markCourierNotificationsRead));
  app.post(`${basePath}/verification/identity`, requireAuth, asyncHandler(verifyCourierIdentity));
  app.post(`${basePath}/verification/face`, requireAuth, asyncHandler(verifyCourierFace));
  app.post(`${basePath}/profile`, requireAuth, asyncHandler(updateCourierProfile));
  app.post(`${basePath}/status`, requireAuth, asyncHandler(updateCourierStatus));
  app.post(`${basePath}/location`, requireAuth, asyncHandler(updateCourierPosition));
  app.post(`${basePath}/jobs/:assignmentId/accept`, requireAuth, asyncHandler(acceptCourierAssignment));
  app.post(`${basePath}/jobs/:assignmentId/reject`, requireAuth, asyncHandler(rejectCourierAssignment));
  app.post(`${basePath}/jobs/:assignmentId/arrive-store`, requireAuth, asyncHandler(arriveCourierStore));
  app.post(`${basePath}/jobs/:assignmentId/verify-pickup`, requireAuth, asyncHandler(verifyCourierPickup));
  app.post(`${basePath}/jobs/:assignmentId/verify-dropoff`, requireAuth, asyncHandler(verifyCourierDropoff));
}
