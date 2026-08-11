import { prisma } from "@deliverhub/server-platform/database/prisma";

export async function listRecentOrdersByTenant(tenantId, { limit = 10 } = {}) {
  return prisma.order.findMany({
    where: { tenantId },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalMnt: true,
      customerAddress: { select: { label: true } },
    },
  });
}

export async function findEmployeeInAdminReview(tenantId) {
  return prisma.deliveryEmployee.findFirst({
    where: { tenantId, verificationStatus: "ADMIN_REVIEW" },
    select: { id: true, verificationStatus: true },
  });
}

export async function findDispatchOrder(tenantId, orderId) {
  return prisma.order.findFirst({
    where: {
      tenantId,
      ...(orderId ? { id: orderId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { store: true },
  });
}

export async function countMatchingEmployees(tenantId, vehicleTypes) {
  return prisma.deliveryEmployee.count({
    where: {
      tenantId,
      online: true,
      verificationStatus: "ACTIVE",
      vehicleType: { in: vehicleTypes },
    },
  });
}

export async function createDeliveryOffer(tenantId, orderId) {
  return prisma.deliveryAssignment.create({
    data: {
      tenantId,
      orderId,
      status: "OFFERED",
    },
    include: { order: { include: { store: true } } },
  });
}

export async function updateOrderStatus(tenantId, orderId, status, note) {
  return prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { id: orderId, tenantId },
      data: { status },
    });

    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: { store: true },
    });

    if (!order) throw new Error("Order not found.");

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status,
        note,
      },
    });

    return order;
  });
}
