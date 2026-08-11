import { prisma } from "@deliverhub/server-platform/database/prisma";

const busyAssignmentStatuses = [
  "ACCEPTED",
  "ARRIVING_PICKUP",
  "PICKUP_VERIFICATION",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVING_DROPOFF",
];

export async function listRecentOrdersByTenant(tenantId, { limit = 10 } = {}) {
  return prisma.order.findMany({
    where: { tenantId },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalMnt: true,
      branch: { select: { latitude: true, longitude: true } },
      customerAddress: { select: { label: true, latitude: true, longitude: true } },
      items: { include: { variant: true } },
      deliveryAssignments: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { employee: { include: { user: true } } },
      },
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
    include: { store: true, branch: true, customerAddress: true },
  });
}

export async function listMatchingEmployees(tenantId, vehicleTypes) {
  return prisma.deliveryEmployee.findMany({
    where: {
      tenantId,
      online: true,
      verificationStatus: "ACTIVE",
      vehicleType: { in: vehicleTypes },
      assignments: {
        none: { status: { in: busyAssignmentStatuses } },
      },
    },
    include: { user: true },
    orderBy: { id: "asc" },
  });
}

export async function countMatchingEmployees(tenantId, vehicleTypes) {
  return prisma.deliveryEmployee.count({
    where: {
      tenantId,
      online: true,
      verificationStatus: "ACTIVE",
      vehicleType: { in: vehicleTypes },
      assignments: {
        none: { status: { in: busyAssignmentStatuses } },
      },
    },
  });
}

export async function createDeliveryOffer(tenantId, orderId, employeeId = null) {
  return prisma.deliveryAssignment.create({
    data: {
      tenantId,
      orderId,
      employeeId,
      status: "OFFERED",
    },
    include: { employee: { include: { user: true } }, order: { include: { store: true, branch: true, customerAddress: true } } },
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
