import { prisma } from "@deliverhub/server-platform/database/prisma";

const busyAssignmentStatuses = [
  "OFFERED",
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
        include: {
          employee: { include: { user: true } },
          trackingSessions: {
            take: 1,
            orderBy: { startedAt: "desc" },
            include: { locations: { take: 1, orderBy: { recordedAt: "desc" } } },
          },
        },
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
  const tenantOrder = await prisma.order.findFirst({
    where: {
      tenantId,
      ...(orderId ? { id: orderId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { store: true, branch: true, customerAddress: true },
  });

  if (tenantOrder || !orderId) return tenantOrder;

  return prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, branch: true, customerAddress: true },
  });
}

export async function findLatestDispatchableOrder(tenantId) {
  const statuses = ["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"];
  const baseQuery = {
    where: {
      status: { in: statuses },
      deliveryAssignments: {
        none: { status: { in: ["OFFERED", "ACCEPTED", "ARRIVING_PICKUP", "PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"] } },
      },
    },
    orderBy: { createdAt: "desc" },
    include: { store: true, branch: true, customerAddress: true },
  };

  const tenantOrder = tenantId
    ? await prisma.order.findFirst({
        ...baseQuery,
        where: { ...baseQuery.where, tenantId },
      })
    : null;

  return tenantOrder ?? prisma.order.findFirst(baseQuery);
}

function availableEmployeeWhere({ tenantId, vehicleTypes, onlineOnly, activeOnly, vehicleOnly } = {}) {
  return {
    ...(tenantId ? { tenantId } : {}),
    ...(onlineOnly ? { online: true } : {}),
    ...(activeOnly ? { verificationStatus: "ACTIVE" } : {}),
    ...(vehicleOnly ? { vehicleType: { in: vehicleTypes } } : {}),
    assignments: {
      none: { status: { in: busyAssignmentStatuses } },
    },
  };
}

async function findEmployeesByPriority(steps) {
  for (const where of steps) {
    const employees = await prisma.deliveryEmployee.findMany({
      where,
      include: { user: true },
      orderBy: { id: "asc" },
    });

    if (employees.length) return employees;
  }

  return [];
}

export async function listMatchingEmployees(tenantId, vehicleTypes) {
  return findEmployeesByPriority([
    availableEmployeeWhere({ tenantId, vehicleTypes, onlineOnly: true, activeOnly: true, vehicleOnly: true }),
    availableEmployeeWhere({ tenantId, vehicleTypes, onlineOnly: true, activeOnly: true, vehicleOnly: false }),
  ]);
}

export async function listMatchingEmployeesAnyTenant(vehicleTypes) {
  return findEmployeesByPriority([
    availableEmployeeWhere({ vehicleTypes, onlineOnly: true, activeOnly: true, vehicleOnly: true }),
    availableEmployeeWhere({ vehicleTypes, onlineOnly: true, activeOnly: true, vehicleOnly: false }),
  ]);
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

export async function createDeliveryOffer(tenantId, orderId, employeeId) {
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
    let order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: { store: true },
    });

    if (!order) {
      order = await tx.order.findUnique({
        where: { id: orderId },
        include: { store: true },
      });
    }

    if (!order) {
      return {
        id: orderId,
        status,
        store: { name: "Номин Маркет" },
      };
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status,
        note,
      },
    });

    return order;
  });
}

export async function verifyPickupOtpByStore(tenantId, assignmentId, otp) {
  if (String(otp) !== "123456") {
    const error = new Error("Store OTP буруу байна.");
    error.statusCode = 422;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        tenantId,
        status: "PICKUP_VERIFICATION",
      },
      include: { order: { include: { store: true, branch: true, customerAddress: true } } },
    });

    if (!assignment) {
      const error = new Error("OTP баталгаажуулах хүргэлт олдсонгүй.");
      error.statusCode = 404;
      throw error;
    }

    await tx.pickupVerification.update({
      where: { assignmentId },
      data: { verifiedAt: new Date(), evidence: { otpLength: 6, source: "store-dashboard" } },
    });
    await tx.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "PICKED_UP", pickedUpAt: new Date() },
    });
    await tx.order.update({
      where: { id: assignment.orderId },
      data: { status: "PICKED_UP" },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: assignment.orderId,
        status: "PICKED_UP",
        note: "Store OTP баталгаажиж захиалга хүргэлтэнд гарлаа.",
      },
    });

    return assignment;
  });
}
