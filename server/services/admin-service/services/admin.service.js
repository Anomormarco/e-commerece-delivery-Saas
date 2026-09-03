import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  activateAllStoreSubscriptions,
  createPlatformEmployee,
  createPlatformStore,
  deactivatePlatformEmployee,
  deactivatePlatformStore,
  deletePlatformEmployee,
  deletePlatformStore,
  extendPlatformStoreSubscription,
  getAdminDashboardStats,
  listPlatformEmployees,
  listPlatformStores,
  listRecentDeliveryAssignments,
  updatePlatformEmployee,
  updatePlatformStore,
} from "../repositories/admin.repository.js";

const emptyStats = {
  activeDeliveries: 0,
  pendingPickups: 0,
  tenants: 0,
  creditedRevenueMnt: 0n,
};

function subscriptionView(tenant) {
  const sub = tenant?.subscriptions?.[0] ?? null;
  const now = new Date();
  const endsAt = sub?.endsAt ? new Date(sub.endsAt) : null;
  const active = tenant?.status === "ACTIVE" || (sub?.status === "ACTIVE" && (!endsAt || endsAt > now));
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000)) : null;

  return {
    paid: active,
    status: active ? "PAID" : sub?.status ?? tenant?.status ?? "UNPAID",
    statusLabel: active ? "Төлбөр төлсөн" : "Төлбөргүй",
    planName: sub?.plan?.name ?? "—",
    amountMnt: sub?.plan?.monthlyPriceMnt ? sub.plan.monthlyPriceMnt.toString() : "0",
    startsAt: sub?.startsAt ? new Date(sub.startsAt).toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    daysLeft,
  };
}

export async function getAdminDashboard() {
  return appCache.remember("admin:dashboard", loadAdminDashboard, 10_000);
}

async function loadAdminDashboard() {
  let stats = emptyStats;
  let queue = [];
  let stores = [];
  let employees = [];

  try {
    [stats, queue, stores, employees] = await Promise.all([
      getAdminDashboardStats(),
      listRecentDeliveryAssignments({ limit: 8 }),
      listPlatformStores(),
      listPlatformEmployees(),
    ]);
  } catch (error) {
    console.warn("Admin dashboard cache loader fell back to empty data.", error.message);
  }

  const storeRows = stores.map((store) => {
    const subscription = subscriptionView(store.tenant);
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description ?? "",
      status: store.isActive ? "ACTIVE" : "SUSPENDED",
      statusLabel: store.isActive ? "Идэвхтэй" : "Идэвхгүй",
      tenantId: store.tenant?.id ?? "",
      tenantName: store.tenant?.name ?? "",
      tenantStatus: store.tenant?.status ?? "",
      address: store.branches?.[0]?.address ?? "",
      productCount: store._count.products,
      orderCount: store._count.orders,
      createdAt: store.createdAt ? new Date(store.createdAt).toISOString() : null,
      subscription,
    };
  });

  const employeeRows = employees.map((employee) => ({
    id: employee.id,
    name: employee.fullName,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    status: employee.status,
    statusLabel: employee.status === "ACTIVE" ? "Идэвхтэй" : employee.status,
    createdAt: employee.createdAt ? new Date(employee.createdAt).toISOString() : null,
    roles: employee.userRoles.map((userRole) => ({
      code: userRole.role.code,
      name: userRole.role.name,
    })),
    tenantName: employee.tenantMemberships?.[0]?.tenant?.name ?? "",
    tenantRole: employee.tenantMemberships?.[0]?.role ?? "",
    courier: employee.deliveryEmployee
      ? {
          vehicleType: employee.deliveryEmployee.vehicleType ?? "",
          vehiclePlate: employee.deliveryEmployee.vehiclePlate ?? "",
          online: employee.deliveryEmployee.online,
          rating: employee.deliveryEmployee.rating ? Number(employee.deliveryEmployee.rating) : null,
          verificationStatus: employee.deliveryEmployee.verificationStatus ?? "",
        }
      : null,
  }));

  const paidStores = storeRows.filter((store) => store.subscription.paid).length;

  return {
    metrics: [
      { label: "Active deliveries", value: String(stats.activeDeliveries), note: "now" },
      { label: "Pending pickups", value: String(stats.pendingPickups), note: "queue" },
      { label: "Tenant", value: String(stats.tenants), note: "total" },
      { label: "Revenue", value: stats.creditedRevenueMnt.toString(), note: "MNT" },
      { label: "Paid stores", value: `${paidStores}/${storeRows.length}`, note: "subscription" },
    ],
    verificationQueue: queue.map((item) => ({
      id: item.id,
      state: item.status,
      name: item.order.store.name,
      distance: "тооцоолоогүй",
    })),
    stores: storeRows,
    employees: employeeRows,
    alerts: [],
  };
}

async function bust() {
  await appCache.del("admin:dashboard");
}

export async function createAdminStore(payload) {
  const result = await createPlatformStore(payload);
  await bust();
  return result;
}

export async function updateAdminStore(storeId, payload) {
  await updatePlatformStore(storeId, payload);
  await bust();
}

export async function deleteAdminStore(storeId, { hard = false } = {}) {
  if (hard) await deletePlatformStore(storeId);
  else await deactivatePlatformStore(storeId);
  await bust();
}

export async function extendAdminStoreSubscription(storeId, months) {
  const result = await extendPlatformStoreSubscription(storeId, months);
  await bust();
  return result;
}

export async function activateAllAdminSubscriptions(months) {
  const result = await activateAllStoreSubscriptions(months);
  await bust();
  return result;
}

export async function createAdminEmployee(payload) {
  const result = await createPlatformEmployee(payload);
  await bust();
  return result;
}

export async function updateAdminEmployee(userId, payload) {
  await updatePlatformEmployee(userId, payload);
  await bust();
}

export async function deleteAdminEmployee(userId, { hard = false } = {}) {
  if (hard) await deletePlatformEmployee(userId);
  else await deactivatePlatformEmployee(userId);
  await bust();
}
