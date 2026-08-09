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
