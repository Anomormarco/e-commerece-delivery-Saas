import { prisma } from "@deliverhub/server-platform/database/prisma";
import { sendMail } from "@deliverhub/server-platform/email/smtp-mailer";
import { createSixDigitOtp, hashOtp, otpMatches } from "@deliverhub/server-platform/security/otp";
import { appCache } from "@deliverhub/server-platform/cache/memory-cache";

const activeAssignmentStatuses = [
  "ACCEPTED",
  "ARRIVING_PICKUP",
  "PICKUP_VERIFICATION",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVING_DROPOFF",
];

const defaultTenant = {
  name: "DeliverHub Public",
  slug: "deliverhub-public",
};

const offerTimeoutMs = 10_000;
const maxCourierOfferAttempts = 5;
const busyAssignmentWindowMs = 2 * 60 * 60 * 1000;
const defaultStoreLocation = { lat: 47.91785, lng: 106.93528 };

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pickupLocation(order) {
  return defaultStoreLocation;
}

function dropoffLocation(order, pickup) {
  return {
    lat: toNumber(order.customerAddress?.latitude, pickup.lat + 0.043),
    lng: toNumber(order.customerAddress?.longitude, pickup.lng + 0.064),
  };
}

function haversineKm(from, to) {
  const earthKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashToUnit(input = "") {
  let hash = 0;
  for (const char of String(input)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return (hash % 10_000) / 10_000;
}

function employeeLiveLocation(employee, pickup) {
  return {
    lat: pickup.lat + (hashToUnit(`${employee.id}:lat`) - 0.5) * 0.045,
    lng: pickup.lng + (hashToUnit(`${employee.id}:lng`) - 0.5) * 0.06,
  };
}

function assignmentOrderWeightKg(order) {
  const grams = (order.items ?? []).reduce((sum, item) => {
    const weight = item.variant?.weightGrams ?? 500;
    return sum + weight * item.quantity;
  }, 0);

  return Math.max(1, Math.ceil(grams / 1000));
}

function assignmentOrderDistanceKm(order) {
  const pickup = pickupLocation(order);
  const dropoff = dropoffLocation(order, pickup);
  return Number(haversineKm(pickup, dropoff).toFixed(1)) || (order.customerAddressId ? 4.8 : 2.4);
}

function requiredVehicle(weightKg, distanceKm) {
  if (weightKg > 12 || distanceKm > 8) return "CAR";
  if (weightKg > 4 || distanceKm > 3) return "MOPED";
  return "WALK";
}

function canVehicleServe(employeeVehicle, requirement) {
  const rank = { WALK: 1, MOPED: 2, CAR: 3 };
  return (rank[employeeVehicle] ?? 1) >= (rank[requirement] ?? 1);
}

function busyAssignmentWhere() {
  return {
    status: { in: ["OFFERED", ...activeAssignmentStatuses] },
    createdAt: { gte: new Date(Date.now() - busyAssignmentWindowMs) },
  };
}

function employeeToPickupKm(order, employee) {
  const pickup = pickupLocation(order);
  return haversineKm(employeeLiveLocation(employee, pickup), pickup);
}

async function createNextCourierOffer(transaction, { tenantId, orderId }) {
  const order = await transaction.order.findFirst({
    where: { id: orderId, tenantId },
    include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } },
  });

  if (!order) return null;

  const previousOffers = await transaction.deliveryAssignment.findMany({
    where: { orderId, employeeId: { not: null } },
    select: { employeeId: true },
  });
  const excludedEmployeeIds = previousOffers.map((offer) => offer.employeeId).filter(Boolean);
  if (excludedEmployeeIds.length >= maxCourierOfferAttempts) return null;
  const weightKg = assignmentOrderWeightKg(order);
  const distanceKm = assignmentOrderDistanceKm(order);
  const requirement = requiredVehicle(weightKg, distanceKm);
  let candidates = await transaction.deliveryEmployee.findMany({
    where: {
      tenantId,
      online: true,
      verificationStatus: "ACTIVE",
      ...(excludedEmployeeIds.length ? { id: { notIn: excludedEmployeeIds } } : {}),
      assignments: {
        none: busyAssignmentWhere(),
      },
    },
    include: { user: true },
  });
  if (!candidates.length) {
    candidates = await transaction.deliveryEmployee.findMany({
      where: {
        online: true,
        verificationStatus: "ACTIVE",
        ...(excludedEmployeeIds.length ? { id: { notIn: excludedEmployeeIds } } : {}),
        assignments: {
          none: busyAssignmentWhere(),
        },
      },
      include: { user: true },
    });
  }
  const nextEmployee = candidates
    .filter((employee) => canVehicleServe(employee.vehicleType, requirement))
    .map((employee) => ({ employee, toPickupKm: employeeToPickupKm(order, employee) }))
    .sort((left, right) => left.toPickupKm - right.toPickupKm)[0]?.employee;

  if (!nextEmployee) return null;

  return transaction.deliveryAssignment.create({
    data: {
      tenantId,
      orderId,
      employeeId: nextEmployee.id,
      status: "OFFERED",
    },
  });
}

export async function advanceExpiredCourierOffers(tenantId) {
  const cutoff = new Date(Date.now() - offerTimeoutMs);
  const expiredOffers = await prisma.deliveryAssignment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: "OFFERED",
      employeeId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderId: true, tenantId: true },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  let expiredCount = 0;
  let reofferedCount = 0;

  for (const offer of expiredOffers) {
    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.deliveryAssignment.updateMany({
        where: {
          id: offer.id,
          status: "OFFERED",
          createdAt: { lt: cutoff },
        },
        data: { status: "REJECTED" },
      });

      if (updateResult.count !== 1) return { expired: false, reoffered: false };

      await transaction.deliveryAttempt.create({
        data: {
          assignmentId: offer.id,
          reason: "OFFER_TIMEOUT",
          note: "Employee did not answer within 10 seconds; offer moved to the next nearest courier.",
        },
      });

      const activeAssignment = await transaction.deliveryAssignment.findFirst({
        where: { orderId: offer.orderId, ...busyAssignmentWhere() },
        select: { id: true },
      });

      if (activeAssignment) return { expired: true, reoffered: false };

      const nextOffer = await createNextCourierOffer(transaction, {
        tenantId: offer.tenantId,
        orderId: offer.orderId,
      });

      if (nextOffer) return { expired: true, reoffered: true };

      await transaction.order.updateMany({
        where: { id: offer.orderId, status: "COURIER_ASSIGNED" },
        data: { status: "READY_FOR_PICKUP" },
      });
      await transaction.orderStatusHistory.create({
        data: {
          orderId: offer.orderId,
          status: "READY_FOR_PICKUP",
          note: "Courier offer expired; store can call delivery again.",
        },
      });
      return { expired: true, reoffered: false };
    });

    if (result.expired) expiredCount += 1;
    if (result.reoffered) reofferedCount += 1;
  }

  return { expiredCount, reofferedCount };
}

function includeCourierDashboard() {
  return {
    assignments: {
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        order: { include: { store: true, branch: true, customer: { select: { phone: true } }, customerAddress: true, items: { include: { variant: true } } } },
        trackingSessions: {
          take: 1,
          orderBy: { startedAt: "desc" },
          include: { locations: { take: 1, orderBy: { recordedAt: "desc" } } },
        },
      },
    },
    wallet: true,
    user: {
      include: {
        faceVerificationSessions: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        identityProfile: {
          include: {
            sessions: {
              take: 8,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    },
  };
}

export async function recordCourierLocation(userId, payload = {}) {
  const lat = Number(payload.lat ?? payload.latitude);
  const lng = Number(payload.lng ?? payload.longitude);
  const accuracyMeters = payload.accuracyMeters == null ? null : Number(payload.accuracyMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw createHttpError(400, "Байршлын координат буруу байна.");
  }

  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.deliveryEmployee.findFirst({
      where: { userId },
      include: {
        assignments: {
          take: 1,
          orderBy: { acceptedAt: "desc" },
          where: { status: { in: activeAssignmentStatuses } },
          select: { id: true, orderId: true },
        },
      },
    });

    if (!employee) throw createHttpError(404, "Хүргэлтийн ажилтан олдсонгүй.");
    await appCache.set(`courier:live-location:${employee.id}`, {
      lat,
      lng,
      userId,
      updatedAt: new Date().toISOString(),
    }, 60_000);

    const assignment = employee.assignments[0];
    if (!assignment) return { ok: true, assignmentId: null, employeeId: employee.id, userId, lat, lng };

    const session = await transaction.trackingSession.findFirst({
      where: { assignmentId: assignment.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }) ?? await transaction.trackingSession.create({
      data: { assignmentId: assignment.id },
      select: { id: true },
    });

    await transaction.locationPoint.create({
      data: {
        trackingSessionId: session.id,
        latitude: lat,
        longitude: lng,
        accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : null,
      },
    });

    return { ok: true, assignmentId: assignment.id, orderId: assignment.orderId, employeeId: employee.id, userId, lat, lng };
  });
}

export async function ensureDefaultTenant() {
  return prisma.tenant.upsert({
    where: { slug: defaultTenant.slug },
    update: {},
    create: defaultTenant,
  });
}

export async function ensureDeliveryEmployeeRole(client = prisma) {
  return client.role.upsert({
    where: { code: "DELIVERY_EMPLOYEE" },
    update: {},
    create: { code: "DELIVERY_EMPLOYEE", name: "Хүргэлтийн ажилтан" },
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

export async function findCourierByContact({ loginId, phone, email } = {}) {
  const contactFilters = [];
  const normalizedLoginId = String(loginId ?? "").trim();

  if (normalizedLoginId) {
    const isEmail = normalizedLoginId.includes("@");
    contactFilters.push({ user: isEmail ? { email: normalizedLoginId } : { phone: normalizedLoginId } });
  }

  if (phone) {
    contactFilters.push({ user: { phone } });
  }

  if (email) {
    contactFilters.push({ user: { email } });
  }

  if (!contactFilters.length) return null;

  return prisma.deliveryEmployee.findFirst({
    where: { OR: contactFilters },
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
  const employeeRole = await ensureDeliveryEmployeeRole();
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
        userRoles: {
          create: {
            roleId: employeeRole.id,
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

    const employeeRole = await ensureDeliveryEmployeeRole(transaction);
    await transaction.userRole.upsert({
      where: { userId_roleId: { userId, roleId: employeeRole.id } },
      update: {},
      create: { userId, roleId: employeeRole.id },
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

export async function recordFailedLoginFaceVerification(userId, payload) {
  if (!userId) return null;

  await prisma.faceVerificationSession.create({
    data: {
      userId,
      provider: "deliverhub-login-face-check",
      status: "ADMIN_REVIEW",
      livenessResult: payload,
      faceMatchScore: "0.0000",
      verifiedAt: null,
    },
  });

  return null;
}

export async function updateCourierProfileRecord(userId, payload = {}) {
  const employee = await prisma.deliveryEmployee.findUnique({
    where: { userId },
    include: { user: { include: { identityProfile: true } } },
  });

  if (!employee) {
    throw createHttpError(404, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.");
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
      },
    });

    await transaction.deliveryEmployee.update({
      where: { id: employee.id },
      data: {
        vehicleType: payload.vehicleType,
        vehiclePlate: payload.vehiclePlate,
      },
    });

    const identityProfile = await transaction.identityProfile.upsert({
      where: { userId },
      update: {
        legalName: payload.fullName,
        status: employee.verificationStatus,
      },
      create: {
        userId,
        legalName: payload.fullName,
        status: employee.verificationStatus,
      },
    });

    await transaction.identityVerificationSession.create({
      data: {
        identityProfileId: identityProfile.id,
        provider: "deliverhub-employee-profile-edit",
        status: "IDENTITY_VERIFIED",
        result: payload.profile,
        verifiedAt: new Date(),
      },
    });

    return transaction.deliveryEmployee.findUniqueOrThrow({
      where: { id: employee.id },
      include: includeCourierDashboard(),
    });
  });
}

export async function findCourierDashboardByUserId(userId) {
  const employeeSeed = userId
    ? await prisma.deliveryEmployee.findUnique({
        where: { userId },
        select: { tenantId: true },
      })
    : await prisma.deliveryEmployee.findFirst({
        orderBy: { id: "asc" },
        select: { tenantId: true },
      });

  if (!employeeSeed) return null;

  await advanceExpiredCourierOffers();

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

  const completedDeliveriesCount = await prisma.deliveryAssignment.count({
    where: { employeeId: employee.id, status: "DELIVERED" },
  });

  return {
    ...employee,
    assignments: employee.assignments,
    completedDeliveriesCount,
  };
}

export async function updateCourierOnlineState(userId, online) {
  const employee = await findCourierDashboardByUserId(userId);

  if (!employee) {
    return null;
  }

  return prisma.$transaction(async (transaction) => {
    if (!online) {
      const cancelledAssignments = await transaction.deliveryAssignment.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ["OFFERED", ...activeAssignmentStatuses] },
        },
        select: { id: true, orderId: true },
      });

      if (cancelledAssignments.length) {
        await transaction.deliveryAssignment.updateMany({
          where: { id: { in: cancelledAssignments.map((assignment) => assignment.id) } },
          data: { status: "CANCELLED" },
        });

        await transaction.deliveryAttempt.createMany({
          data: cancelledAssignments.map((assignment) => ({
            assignmentId: assignment.id,
            reason: "EMPLOYEE_CANCELLED_SHIFT_END",
            note: "Employee went off work and cancelled the active delivery call.",
          })),
        });

        for (const orderId of [...new Set(cancelledAssignments.map((assignment) => assignment.orderId))]) {
          const remainingActiveAssignment = await transaction.deliveryAssignment.findFirst({
            where: {
              orderId,
              status: { in: ["OFFERED", ...activeAssignmentStatuses] },
            },
            select: { id: true },
          });

          if (!remainingActiveAssignment) {
            await transaction.order.update({
              where: { id: orderId },
              data: { status: "READY_FOR_PICKUP" },
            });
            await transaction.orderStatusHistory.create({
              data: {
                orderId,
                status: "READY_FOR_PICKUP",
                note: "Employee cancelled the active delivery while going off work. Store can call delivery again.",
              },
            });
          }
        }
      }
    }

    return transaction.deliveryEmployee.update({
      where: { id: employee.id },
      data: {
        online,
        ...(online ? { verificationStatus: "ACTIVE" } : {}),
      },
      include: includeCourierDashboard(),
    });
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
      await transaction.deliveryEmployee.update({
        where: { id: employee.id },
        data: { online: true },
        select: { id: true },
      });
    }

    const updateResult = await transaction.deliveryAssignment.updateMany({
      where: {
        id: assignmentId,
        status: "OFFERED",
        employeeId: employee.id,
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

    const acceptedAssignment = await transaction.deliveryAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { orderId: true },
    });

    await transaction.deliveryAssignment.updateMany({
      where: {
        orderId: acceptedAssignment.orderId,
        id: { not: assignmentId },
        status: "OFFERED",
      },
      data: { status: "CANCELLED" },
    });

    await transaction.order.update({
      where: { id: acceptedAssignment.orderId },
      data: { status: "COURIER_ARRIVING" },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: acceptedAssignment.orderId,
        status: "COURIER_ARRIVING",
        note: "Хүргэлтийн ажилтан захиалгыг авч дэлгүүр рүү хөдөллөө.",
      },
    });

    return transaction.deliveryAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { order: { include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } } } },
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

  await prisma.$transaction(async (transaction) => {
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, status: "OFFERED", employeeId: employee.id },
      select: { id: true, orderId: true },
    });

    if (!assignment) return;

    await transaction.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { status: "REJECTED" },
    });

    await transaction.deliveryAttempt.create({
      data: {
        assignmentId: assignment.id,
        reason: "EMPLOYEE_REJECTED",
        note: "Courier rejected the offer; offer moved to the next nearest courier.",
      },
    });

    const activeAssignment = await transaction.deliveryAssignment.findFirst({
      where: {
        orderId: assignment.orderId,
        status: { in: ["OFFERED", ...activeAssignmentStatuses] },
      },
      select: { id: true },
    });

    if (!activeAssignment) {
      await createNextCourierOffer(transaction, { tenantId: employee.tenantId, orderId: assignment.orderId });
    }
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
  const pickupOtp = createSixDigitOtp();
  const assignment = await prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: "ACCEPTED" },
      include: { order: { include: { store: true } } },
    });

    if (!assignment) {
      throw createHttpError(409, "\u0417\u04E9\u0432\u0445\u04E9\u043D \u0445\u04AF\u043B\u044D\u044D\u043D \u0430\u0432\u0441\u0430\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u044D\u0434 store \u0434\u044D\u044D\u0440 \u0438\u0440\u0441\u044D\u043D \u0442\u04E9\u043B\u04E9\u0432 \u043E\u0440\u0443\u0443\u043B\u043D\u0430.");
    }

    await transaction.pickupVerification.upsert({
      where: { assignmentId },
      update: {
        qrTokenHash: hashOtp(pickupOtp),
        evidence: { otpSentAt: new Date().toISOString(), source: "courier-arrived-store" },
      },
      create: {
        assignmentId,
        qrTokenHash: hashOtp(pickupOtp),
        evidence: { otpSentAt: new Date().toISOString(), source: "courier-arrived-store" },
      },
    });

    await transaction.order.update({
      where: { id: assignment.orderId },
      data: { status: "PICKUP_VERIFICATION" },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: assignment.orderId,
        status: "PICKUP_VERIFICATION",
        note: "Хүргэлтийн ажилтан дэлгүүр дээр ирж бараа авах OTP хүлээж байна.",
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "PICKUP_VERIFICATION" },
      include: {
        employee: { include: { user: { select: { email: true, fullName: true } } } },
        order: { include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } } },
      },
    });
  });

  const courierEmail = assignment.employee?.user?.email;
  if (courierEmail) {
    await sendMail({
      to: courierEmail,
      subject: "DeliverHub pickup OTP",
      text: [
        `Pickup OTP: ${pickupOtp}`,
        "",
        `${assignment.order?.store?.name ?? "Store"} дээр очоод энэ 6 оронтой кодыг store owner-д өгнө.`,
        "Store кодыг баталгаажуулсны дараа захиалга хүргэлтэнд гарна.",
      ].join("\n"),
    });
  }

  return assignment;
}

export async function verifyCourierPickupOtp(userId, assignmentId, otp) {
  return prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: "PICKUP_VERIFICATION" },
    });

    if (!assignment) {
      throw createHttpError(409, "Pickup OTP \u0431\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u0445 \u0442\u04E9\u043B\u04E9\u0432 \u0431\u0438\u0448 \u0431\u0430\u0439\u043D\u0430.");
    }

    const verification = await transaction.pickupVerification.findUnique({ where: { assignmentId } });
    if (!otpMatches(otp, verification?.qrTokenHash)) {
      throw createHttpError(422, "Store OTP \u0431\u0443\u0440\u0443\u0443 \u0431\u0430\u0439\u043D\u0430.");
    }

    await transaction.pickupVerification.update({
      where: { assignmentId },
      data: { verifiedAt: new Date(), evidence: { otpLength: 6, source: "store" } },
    });

    await transaction.order.update({
      where: { id: assignment.orderId },
      data: { status: "PICKED_UP" },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: assignment.orderId,
        status: "PICKED_UP",
        note: "Store OTP баталгаажиж захиалга хүргэлтэнд гарлаа.",
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "PICKED_UP", pickedUpAt: new Date() },
      include: { order: { include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } } } },
    });
  });
}

export async function markCourierArrivedAtDropoff(userId, assignmentId) {
  const dropoffOtp = createSixDigitOtp();
  const assignment = await prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: { in: ["PICKED_UP", "IN_TRANSIT"] } },
      include: { order: { include: { customer: true } } },
    });

    if (!assignment) {
      throw createHttpError(409, "Зөвхөн хүлээн авсан хүргэлтэд хэрэглэгч дээр ирсэн төлөв оруулна.");
    }

    await transaction.order.update({
      where: { id: assignment.orderId },
      // OrderStatus enum uses "ARRIVING" (not "ARRIVING_DROPOFF" - that value
      // only exists on AssignmentStatus, set below on the assignment record).
      data: { status: "ARRIVING", deliveryOtpHash: hashOtp(dropoffOtp) },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: assignment.orderId,
        status: "ARRIVING",
        note: "Хүргэлтийн ажилтан хэрэглэгч дээр ирж хүлээн авах OTP хүлээж байна.",
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "ARRIVING_DROPOFF" },
      include: {
        order: { include: { store: true, branch: true, customerAddress: true, customer: true, items: { include: { variant: true } } } },
      },
    });
  });

  const customerEmail = assignment.order?.customer?.email;
  if (customerEmail) {
    await sendMail({
      to: customerEmail,
      subject: "DeliverHub хүргэлтийн баталгаажуулах код",
      text: [
        `Таны баталгаажуулах код: ${dropoffOtp}`,
        "",
        "Хүргэлтийн ажилтан ирсэн үед энэ 6 оронтой кодыг ажилтанд амаар хэлж өгсөнөөр захиалга хүргэгдсэн гэж баталгаажина.",
        "Кодоо зөвхөн өөрийн хүргэлтийн ажилтандаа өгнө үү.",
      ].join("\n"),
    });
  }

  return assignment;
}

export async function verifyCourierDropoffOtp(userId, assignmentId, otp) {
  return prisma.$transaction(async (transaction) => {
    const employee = await findEmployeeForAssignment(transaction, userId);
    const assignment = await transaction.deliveryAssignment.findFirst({
      where: { id: assignmentId, employeeId: employee.id, status: { in: ["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"] } },
      include: { order: true },
    });

    if (!assignment) {
      throw createHttpError(409, "Dropoff OTP баталгаажуулах төлөв биш байна.");
    }

    if (!assignment.order?.deliveryOtpHash) {
      throw createHttpError(409, "Эхлээд 'Хэрэглэгч дээр ирлээ' товчийг дарж, код илгээнэ үү.");
    }

    if (!otpMatches(otp, assignment.order.deliveryOtpHash)) {
      throw createHttpError(422, "Хэрэглэгчийн OTP буруу байна.");
    }

    await transaction.handoverEvidence.upsert({
      where: { assignmentId },
      update: { otpHash: assignment.order.deliveryOtpHash, confirmedAt: new Date() },
      create: {
        assignmentId,
        otpHash: assignment.order.deliveryOtpHash,
        confirmedAt: new Date(),
      },
    });

    await transaction.order.update({
      where: { id: assignment.orderId },
      data: { status: "DELIVERED", deliveryOtpHash: null },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: assignment.orderId,
        status: "DELIVERED",
        note: "Хүргэлт хэрэглэгч дээр амжилттай дууслаа.",
      },
    });

    return transaction.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
      include: { order: { include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } } } },
    });
  });
}
