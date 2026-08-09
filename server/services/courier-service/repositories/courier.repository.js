import { prisma } from "@deliverhub/server-platform/database/prisma";

const activeAssignmentStatuses = [
  "ACCEPTED",
  "ARRIVING_PICKUP",
  "PICKUP_VERIFICATION",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVING_DROPOFF",
];

const defaultTenant = {
  name: "DeliverHub Demo",
  slug: "deliverhub-demo",
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function includeCourierDashboard() {
  return {
    assignments: {
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { order: { include: { store: true, items: { include: { variant: true } } } } },
    },
    wallet: true,
    user: true,
  };
}

export async function ensureDefaultTenant() {
  return prisma.tenant.upsert({
    where: { slug: defaultTenant.slug },
    update: {},
    create: defaultTenant,
  });
}

export async function findCourierByLoginId(loginId) {
  const isEmail = String(loginId).includes("@");
  return prisma.deliveryEmployee.findFirst({
    where: {
      user: isEmail ? { email: loginId } : { phone: loginId },
    },
    include: includeCourierDashboard(),
  });
}

export async function createCourierApplication({
  fullName,
  loginId,
  phone,
  email,
  passwordHash,
  vehicleType,
  vehiclePlate,
  applicationProfile,
  identityVerification,
  faceVerification,
}) {
  const tenant = await ensureDefaultTenant();
  const isEmail = String(loginId).includes("@");

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        fullName,
        email: email ?? (isEmail ? loginId : null),
        phone: phone ?? (isEmail ? null : loginId),
        passwordHash,
        tenantMemberships: {
          create: {
            tenantId: tenant.id,
            role: "DELIVERY_EMPLOYEE",
          },
        },
        deliveryEmployee: {
          create: {
            tenantId: tenant.id,
            vehicleType,
            vehiclePlate,
            verificationStatus: "ACTIVE",
            wallet: { create: { balanceMnt: 0n } },
          },
        },
        identityProfile: {
          create: {
            legalName: identityVerification?.legalName ?? fullName,
            status: "ACTIVE",
            sessions: {
              create: [
                {
                  provider: "deliverhub-employee-register-step-1",
                  status: "IDENTITY_VERIFIED",
                  result: applicationProfile,
                  verifiedAt: new Date(),
                },
                {
                  provider: "deliverhub-demo-document-match",
                  status: "IDENTITY_VERIFIED",
                  result: identityVerification,
                  verifiedAt: new Date(),
                },
              ],
            },
          },
        },
      },
      include: { deliveryEmployee: true },
    });

    await transaction.faceVerificationSession.create({
      data: {
        userId: user.id,
        provider: "deliverhub-register-face-passport-match",
        status: "FACE_VERIFIED",
        livenessResult: faceVerification,
        faceMatchScore: "0.9720",
        verifiedAt: new Date(),
      },
    });

    return transaction.deliveryEmployee.findUniqueOrThrow({
      where: { id: user.deliveryEmployee.id },
      include: includeCourierDashboard(),
    });
  });
}

export async function activateExistingCourierApplication({
  employeeId,
  userId,
  fullName,
  phone,
  email,
  passwordHash,
  vehicleType,
  vehiclePlate,
  applicationProfile,
  identityVerification,
  faceVerification,
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        fullName,
        phone,
        email,
        passwordHash,
      },
    });

    await transaction.deliveryEmployee.update({
      where: { id: employeeId },
      data: {
        vehicleType,
        vehiclePlate,
        verificationStatus: "ACTIVE",
      },
    });

    await transaction.courierWallet.upsert({
      where: { employeeId },
      update: {},
      create: { employeeId, balanceMnt: 0n },
    });

    const profile = await transaction.identityProfile.upsert({
      where: { userId },
      update: {
        legalName: identityVerification?.legalName ?? fullName,
        status: "ACTIVE",
      },
      create: {
        userId,
        legalName: identityVerification?.legalName ?? fullName,
        status: "ACTIVE",
      },
    });

    await transaction.identityVerificationSession.createMany({
      data: [
        {
          identityProfileId: profile.id,
          provider: "deliverhub-employee-register-step-1",
          status: "IDENTITY_VERIFIED",
          result: applicationProfile,
          verifiedAt: new Date(),
        },
        {
          identityProfileId: profile.id,
          provider: "deliverhub-demo-document-match",
          status: "IDENTITY_VERIFIED",
          result: identityVerification,
          verifiedAt: new Date(),
        },
      ],
    });

    await transaction.faceVerificationSession.create({
      data: {
        userId,
        provider: "deliverhub-register-face-passport-match",
        status: "FACE_VERIFIED",
        livenessResult: faceVerification,
        faceMatchScore: "0.9720",
        verifiedAt: new Date(),
      },
    });

    return transaction.deliveryEmployee.findUniqueOrThrow({
      where: { id: employeeId },
      include: includeCourierDashboard(),
    });
  });
}

export async function recordIdentityVerification(userId, payload) {
  const employee = await prisma.deliveryEmployee.findUnique({ where: { userId } });

  if (!employee) {
    throw createHttpError(404, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  return prisma.$transaction(async (transaction) => {
    const profile = await transaction.identityProfile.upsert({
      where: { userId },
      update: {
        legalName: payload.legalName,
        status: "IDENTITY_VERIFIED",
      },
      create: {
        userId,
        legalName: payload.legalName,
        status: "IDENTITY_VERIFIED",
      },
    });

    await transaction.identityVerificationSession.create({
      data: {
        identityProfileId: profile.id,
        provider: "deliverhub-demo-kyc",
        status: "IDENTITY_VERIFIED",
        result: payload,
        verifiedAt: new Date(),
      },
    });

    return transaction.deliveryEmployee.update({
      where: { id: employee.id },
      data: { verificationStatus: "FACE_PENDING" },
      include: includeCourierDashboard(),
    });
  });
}

export async function recordFaceVerification(userId, payload) {
  const employee = await prisma.deliveryEmployee.findUnique({ where: { userId } });

  if (!employee) {
    throw createHttpError(404, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  const passed = Boolean(payload.selfieWithDocument && payload.livenessConfirmed);

  return prisma.$transaction(async (transaction) => {
    await transaction.faceVerificationSession.create({
      data: {
        userId,
        provider: "deliverhub-demo-face-match",
        status: passed ? "FACE_VERIFIED" : "ADMIN_REVIEW",
        livenessResult: payload,
        faceMatchScore: passed ? "0.9720" : "0.6100",
        verifiedAt: passed ? new Date() : null,
      },
    });

    await transaction.identityProfile.updateMany({
      where: { userId },
      data: { status: passed ? "ACTIVE" : "ADMIN_REVIEW" },
    });

    return transaction.deliveryEmployee.update({
      where: { id: employee.id },
      data: { verificationStatus: passed ? "ACTIVE" : "ADMIN_REVIEW" },
      include: includeCourierDashboard(),
    });
  });
}

export async function recordLoginFaceVerification(userId, payload) {
  const employee = await prisma.deliveryEmployee.findUnique({ where: { userId } });

  if (!employee) {
    throw createHttpError(404, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  await prisma.faceVerificationSession.create({
    data: {
      userId,
      provider: "deliverhub-login-face-check",
      status: "FACE_VERIFIED",
      livenessResult: payload,
      faceMatchScore: "0.9810",
      verifiedAt: new Date(),
    },
  });

  return findCourierDashboardByUserId(userId);
}

export async function findCourierDashboardByUserId(userId) {
  const employee = userId
    ? await prisma.deliveryEmployee.findUnique({
        where: { userId },
        include: includeCourierDashboard(),
      })
    : await prisma.deliveryEmployee.findFirst({
        orderBy: { id: "asc" },
        include: includeCourierDashboard(),
      });

  if (!employee) return null;

  const openOffers = await prisma.deliveryAssignment.findMany({
    where: {
      tenantId: employee.tenantId,
      employeeId: null,
      status: "OFFERED",
    },
    take: 12,
    orderBy: { createdAt: "desc" },
    include: { order: { include: { store: true, items: { include: { variant: true } } } } },
  });

  return {
    ...employee,
    assignments: [...employee.assignments, ...openOffers],
  };
}

export async function updateCourierOnlineState(userId, online) {
  const employee = await findCourierDashboardByUserId(userId);

  if (!employee) {
    return null;
  }

  const hasActiveDelivery = employee.assignments.some((assignment) =>
    activeAssignmentStatuses.includes(assignment.status),
  );

  if (!online && hasActiveDelivery) {
    throw createHttpError(409, "\u0418\u0434\u044D\u0432\u0445\u0442\u044D\u0439 \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0442\u044D\u0439 \u04AF\u0435\u0434 offline \u0431\u043E\u043B\u043E\u0445\u0433\u04AF\u0439.");
  }

  return prisma.deliveryEmployee.update({
    where: { id: employee.id },
    data: { online },
    include: includeCourierDashboard(),
  });
}

export async function acceptDeliveryAssignment(userId, assignmentId) {
  return prisma.$transaction(async (transaction) => {
    const employee = userId
      ? await transaction.deliveryEmployee.findUnique({ where: { userId } })
      : await transaction.deliveryEmployee.findFirst({ orderBy: { id: "asc" } });

    if (!employee) {
      throw createHttpError(404, "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
    }

    if (employee.verificationStatus !== "ACTIVE") {
      throw createHttpError(403, "\u0410\u0436\u0438\u043B \u0430\u0432\u0430\u0445\u044B\u043D \u04E9\u043C\u043D\u04E9 \u0431\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u043B\u0442 \u0438\u0434\u044D\u0432\u0445\u0442\u044D\u0439 \u0431\u0430\u0439\u0445 \u0451\u0441\u0442\u043E\u0439.");
    }

    if (!employee.online) {
      throw createHttpError(409, "\u0410\u0436\u0438\u043B \u0430\u0432\u0430\u0445\u044B\u043D \u04E9\u043C\u043D\u04E9 \u043E\u043D\u043B\u0430\u0439\u043D \u0442\u04E9\u043B\u04E9\u0432\u0442 \u043E\u0440\u043D\u043E \u0443\u0443.");
    }

    const updateResult = await transaction.deliveryAssignment.updateMany({
      where: {
        id: assignmentId,
        status: "OFFERED",
        employeeId: null,
      },
      data: {
        employeeId: employee.id,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      throw createHttpError(409, "\u042D\u043D\u044D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u0433 \u04E9\u04E9\u0440 \u0430\u0436\u0438\u043B\u0442\u0430\u043D \u0430\u0432\u0441\u0430\u043D \u044D\u0441\u0432\u044D\u043B \u0430\u0432\u0430\u0445 \u0431\u043E\u043B\u043E\u043C\u0436\u0433\u04AF\u0439 \u0431\u0430\u0439\u043D\u0430.");
    }

    return transaction.deliveryAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { order: { include: { store: true, items: { include: { variant: true } } } } },
    });
  });
}

export async function rejectDeliveryAssignment(userId, assignmentId) {
  const employee = userId
    ? await prisma.deliveryEmployee.findUnique({ where: { userId } })
    : await prisma.deliveryEmployee.findFirst({ orderBy: { id: "asc" } });

  if (!employee) {
    throw createHttpError(404, "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  await prisma.deliveryAssignment.updateMany({
    where: {
      id: assignmentId,
      status: "OFFERED",
      employeeId: null,
    },
    data: { status: "REJECTED" },
  });

  return findCourierDashboardByUserId(userId);
}

async function findEmployeeForAssignment(transaction, userId) {
  const employee = userId
    ? await transaction.deliveryEmployee.findUnique({ where: { userId } })
    : await transaction.deliveryEmployee.findFirst({ orderBy: { id: "asc" } });

  if (!employee) {
    throw createHttpError(404, "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  return employee;
}

export async function markCourierArrivedAtStore(userId, assignmentId) {
  return prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: "ACCEPTED" },
    });

    if (!assignment) {
      throw createHttpError(409, "\u0417\u04E9\u0432\u0445\u04E9\u043D \u0445\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0441\u0430\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u044D\u0434 store \u0434\u044D\u044D\u0440 \u0438\u0440\u0441\u044D\u043D \u0442\u04E9\u043B\u04E9\u0432 \u043E\u0440\u0443\u0443\u043B\u043D\u0430.");
    }

    await transaction.pickupVerification.upsert({
      where: { assignmentId },
      update: { qrTokenHash: "demo-store-otp-123456" },
      create: {
        assignmentId,
        qrTokenHash: "demo-store-otp-123456",
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "PICKUP_VERIFICATION" },
      include: { order: { include: { store: true, items: { include: { variant: true } } } } },
    });
  });
}

export async function verifyCourierPickupOtp(userId, assignmentId, otp) {
  if (String(otp) !== "123456") {
    throw createHttpError(422, "Store OTP \u0431\u0443\u0440\u0443\u0443 \u0431\u0430\u0439\u043D\u0430.");
  }

  return prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: "PICKUP_VERIFICATION" },
    });

    if (!assignment) {
      throw createHttpError(409, "Pickup OTP \u0431\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u0445 \u0442\u04E9\u043B\u04E9\u0432 \u0431\u0438\u0448 \u0431\u0430\u0439\u043D\u0430.");
    }

    await transaction.pickupVerification.update({
      where: { assignmentId },
      data: { verifiedAt: new Date(), evidence: { otpLength: 6, source: "store" } },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "PICKED_UP", pickedUpAt: new Date() },
      include: { order: { include: { store: true, items: { include: { variant: true } } } } },
    });
  });
}

export async function verifyCourierDropoffOtp(userId, assignmentId, otp) {
  if (String(otp) !== "654321") {
    throw createHttpError(422, "Customer OTP \u0431\u0443\u0440\u0443\u0443 \u0431\u0430\u0439\u043D\u0430.");
  }

  return prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: { in: ["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"] } },
    });

    if (!assignment) {
      throw createHttpError(409, "Dropoff OTP \u0431\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u0445 \u0442\u04E9\u043B\u04E9\u0432 \u0431\u0438\u0448 \u0431\u0430\u0439\u043D\u0430.");
    }

    await transaction.handoverEvidence.upsert({
      where: { assignmentId },
      update: { otpHash: "demo-customer-otp-654321", confirmedAt: new Date() },
      create: {
        assignmentId,
        otpHash: "demo-customer-otp-654321",
        confirmedAt: new Date(),
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
      include: { order: { include: { store: true, items: { include: { variant: true } } } } },
    });
  });
}
