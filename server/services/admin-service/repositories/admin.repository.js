import { prisma } from "@deliverhub/server-platform/database/prisma";

export async function getAdminDashboardStats() {
  const [activeDeliveries, pendingPickups, tenants, creditedLedger] = await Promise.all([
    prisma.deliveryAssignment.count({
      where: { status: { in: ["ACCEPTED", "PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT"] } },
    }),
    prisma.deliveryAssignment.count({
      where: { status: { in: ["OFFERED", "ARRIVING_PICKUP"] } },
    }),
    prisma.tenant.count(),
    prisma.ledgerEntry.aggregate({
      where: { type: "CREDIT" },
      _sum: { amountMnt: true },
    }),
  ]);

  return {
    activeDeliveries,
    pendingPickups,
    tenants,
    creditedRevenueMnt: creditedLedger._sum.amountMnt ?? 0n,
  };
}

export async function listRecentDeliveryAssignments({ limit = 8 } = {}) {
  return prisma.deliveryAssignment.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      order: {
        select: {
          store: { select: { name: true } },
        },
      },
    },
  });
}

export async function listPlatformStores({ limit = 100 } = {}) {
  return prisma.store.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      tenant: { select: { name: true, status: true } },
      _count: { select: { products: true, orders: true } },
    },
  });
}

export async function listPlatformEmployees({ limit = 100 } = {}) {
  return prisma.user.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    where: {
      userRoles: {
        some: {
          role: {
            code: { in: ["PLATFORM_ADMIN", "SHOP_ADMIN", "STORE_ADMIN", "DELIVERY_EMPLOYEE"] },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      status: true,
      userRoles: {
        select: {
          role: { select: { code: true, name: true } },
        },
      },
    },
  });
}

export async function updatePlatformStore(storeId, { name, isActive }) {
  return prisma.store.update({
    where: { id: storeId },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
    },
    select: { id: true },
  });
}

export async function deactivatePlatformStore(storeId) {
  return prisma.store.update({
    where: { id: storeId },
    data: { isActive: false },
    select: { id: true },
  });
}

export async function updatePlatformEmployee(userId, { fullName, status }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
      ...(status ? { status } : {}),
    },
    select: { id: true },
  });
}

export async function deactivatePlatformEmployee(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED" },
    select: { id: true },
  });
}
