import { adminEventBus } from "../messaging.js";
import {
  activateAllAdminSubscriptions,
  createAdminEmployee,
  createAdminStore,
  deleteAdminEmployee,
  deleteAdminStore,
  extendAdminStoreSubscription,
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
  const session = await loginPlatformAdmin(request.body, request, response);
  response.json(session);
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

export async function createStore(request, response) {
  const store = await createAdminStore(request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: store.id });
  response.status(201).json({ ok: true, store });
}

export async function updateStore(request, response) {
  await updateAdminStore(request.params.storeId, request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: request.params.storeId });
  response.json({ ok: true });
}

export async function extendStoreSubscription(request, response) {
  const result = await extendAdminStoreSubscription(request.params.storeId, request.body?.months ?? 1);
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: request.params.storeId });
  response.json({ ok: true, subscription: result });
}

export async function activateAllSubscriptions(request, response) {
  const result = await activateAllAdminSubscriptions({
    days: request.body?.days,
    months: request.body?.months,
  });
  adminEventBus.publishSoon("admin.dashboard.refresh", {});
  response.json({ ok: true, ...result });
}

export async function deleteStore(request, response) {
  const hard = request.body?.hard === true || request.query?.hard === "true";
  await deleteAdminStore(request.params.storeId, { hard });
  adminEventBus.publishSoon("admin.dashboard.refresh", { storeId: request.params.storeId });
  response.json({ ok: true });
}

export async function createEmployee(request, response) {
  const employee = await createAdminEmployee(request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { userId: employee.id });
  response.status(201).json({ ok: true, employee });
}

export async function updateEmployee(request, response) {
  await updateAdminEmployee(request.params.userId, request.body);
  adminEventBus.publishSoon("admin.dashboard.refresh", { userId: request.params.userId });
  response.json({ ok: true });
}

export async function deleteEmployee(request, response) {
  const hard = request.body?.hard === true || request.query?.hard === "true";
  await deleteAdminEmployee(request.params.userId, { hard });
  adminEventBus.publishSoon("admin.dashboard.refresh", { userId: request.params.userId });
  response.json({ ok: true });
}
