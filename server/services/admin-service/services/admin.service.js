import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  deactivatePlatformEmployee,
  deactivatePlatformStore,
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

  return {
    metrics: [
      { label: "Active deliveries", value: String(stats.activeDeliveries), note: "now" },
      { label: "Pending pickups", value: String(stats.pendingPickups), note: "queue" },
      { label: "Tenant", value: String(stats.tenants), note: "total" },
      { label: "Revenue", value: stats.creditedRevenueMnt.toString(), note: "MNT" },
    ],
    verificationQueue: queue.map((item) => ({
      id: item.id,
      state: item.status,
      name: item.order.store.name,
      distance: "тооцоолоогүй",
    })),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      status: store.isActive ? "ACTIVE" : "SUSPENDED",
      statusLabel: store.isActive ? "Идэвхтэй" : "Идэвхгүй",
      tenantName: store.tenant?.name ?? "",
      tenantStatus: store.tenant?.status ?? "",
      productCount: store._count.products,
      orderCount: store._count.orders,
    })),
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.fullName,
      email: employee.email ?? employee.phone ?? "",
      status: employee.status,
      statusLabel: employee.status === "ACTIVE" ? "Идэвхтэй" : employee.status,
      roles: employee.userRoles.map((userRole) => ({
        code: userRole.role.code,
        name: userRole.role.name,
      })),
    })),
    alerts: [],
  };
}

export async function updateAdminStore(storeId, payload) {
  await updatePlatformStore(storeId, payload);
  await appCache.del("admin:dashboard");
}

export async function deleteAdminStore(storeId) {
  await deactivatePlatformStore(storeId);
  await appCache.del("admin:dashboard");
}

export async function updateAdminEmployee(userId, payload) {
  await updatePlatformEmployee(userId, payload);
  await appCache.del("admin:dashboard");
}

export async function deleteAdminEmployee(userId) {
  await deactivatePlatformEmployee(userId);
  await appCache.del("admin:dashboard");
}
