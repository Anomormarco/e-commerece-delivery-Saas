import { prisma } from "@deliverhub/server-platform/database/prisma";

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

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

export async function listMatchingEmployeesAnyTenant(vehicleTypes) {
  return prisma.deliveryEmployee.findMany({
    where: {
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

    if (!order) {
      throw createHttpError(404, "Захиалга олдсонгүй.", "NOT_FOUND");
    }

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
