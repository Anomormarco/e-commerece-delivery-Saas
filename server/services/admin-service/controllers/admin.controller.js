import { adminEventBus } from "../messaging.js";
import {
  deleteAdminEmployee,
  deleteAdminStore,
  getAdminDashboard,
  updateAdminEmployee,
  updateAdminStore,
} from "../services/admin.service.js";
import {
  getPlatformAdminFromRequest,
  loginPlatformAdmin,
  logoutPlatformAdmin,
  registerFirstPlatformAdmin,
  updatePlatformAdminProfile,
} from "../services/admin-auth.service.js";

export async function showAdminDashboard(_request, response) {
  response.json(await getAdminDashboard());
}

export async function registerAdmin(request, response) {
  const user = await registerFirstPlatformAdmin(request.body, request, response);
  adminEventBus.publishSoon("admin.registered", { userId: user.id });
  response.status(201).json({ user });
}

export async function loginAdmin(request, response) {
  const user = await loginPlatformAdmin(request.body, request, response);
  response.json({ user });
}

export async function showAdminSession(request, response) {
  const user = await getPlatformAdminFromRequest(request);

  if (!user) {
    response.status(401).json({
      status: "error",
      statusCode: 401,
      message: "Админ эрхээр нэвтрэх шаардлагатай.",
      code: "UNAUTHENTICATED",
      service: "admin-service",
    });
    return;
  }

  response.json({ user });
}

export async function logoutAdmin(request, response) {
  await logoutPlatformAdmin(request, response);
  response.sendStatus(204);
}

export async function updateAdminProfile(request, response) {
  const user = await updatePlatformAdminProfile(request, request.body);
  adminEventBus.publishSoon("admin.profile.updated", { userId: user.id });
  response.json({ user });
}

export async function updateStore(request, response) {
  await updateAdminStore(request.params.storeId, request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: request.params.storeId });
  response.json({ ok: true });
}

export async function deleteStore(request, response) {
  await deleteAdminStore(request.params.storeId);
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: request.params.storeId });
  response.json({ ok: true });
}

export async function updateEmployee(request, response) {
  await updateAdminEmployee(request.params.userId, request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { userId: request.params.userId });
  response.json({ ok: true });
}

export async function deleteEmployee(request, response) {
  await deleteAdminEmployee(request.params.userId);
  adminEventBus.publishSoon("admin.dashboard.refresh", { userId: request.params.userId });
  response.json({ ok: true });
}
