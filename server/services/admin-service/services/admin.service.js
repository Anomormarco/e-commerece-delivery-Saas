import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  getAdminDashboardStats,
  listRecentDeliveryAssignments,
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

  try {
    [stats, queue] = await Promise.all([
      getAdminDashboardStats(),
      listRecentDeliveryAssignments({ limit: 8 }),
    ]);
  } catch (error) {
    console.warn("Admin dashboard cache loader empty local data ашиглаж байна.", error.message);
  }

  return {
    metrics: [
      { label: "Идэвхтэй хүргэлт", value: String(stats.activeDeliveries), note: "одоо" },
      { label: "Хүлээгдэж буй pickup", value: String(stats.pendingPickups), note: "дараалал" },
      { label: "Tenant", value: String(stats.tenants), note: "нийт" },
      { label: "Орлого", value: stats.creditedRevenueMnt.toString(), note: "MNT" },
    ],
    verificationQueue: queue.map((item) => ({
      id: item.id,
      state: item.status,
      name: item.order.store.name,
      distance: "тооцоолоогүй",
    })),
    alerts: [],
  };
}
