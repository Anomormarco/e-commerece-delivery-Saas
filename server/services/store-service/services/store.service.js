import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import { prisma } from "@deliverhub/server-platform/database/prisma";
import { signJwt } from "@deliverhub/server-platform/http/jwt";
import {
  hashPassword,
  isPhoneNumber,
  normalizeGmailAddress,
  normalizePhone,
  validateStrongPassword,
  verifyPassword,
} from "@deliverhub/server-platform/auth/credentials";
import {
  createDeliveryOffer,
  findBusyAssignmentForOrder,
  findEmployeeInAdminReview,
  findDispatchOrder,
  findLatestDispatchableOrder,
  listMatchingEmployees,
  listMatchingEmployeesAnyTenant,
  listRecentOrdersByTenant,
  updateOrderStatus,
  verifyPickupOtpByStore,
} from "../repositories/store.repository.js";
import { checkQpayInvoice, createQpayInvoice, isQpayConfigured } from "./qpay.service.js";

const vehicleLabels = {
  WALK: "Явган хүргэлт",
  MOPED: "Мопед",
  CAR: "Машин",
};

const storeAccessTokenMaxAgeSeconds = 60 * 60 * 8;

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "store";
}

function normalizeStoreLoginId(value) {
  const loginId = String(value ?? "").trim();
  if (!loginId) return "";
  return loginId.includes("@") ? normalizeGmailAddress(loginId) : normalizePhone(loginId);
}

function createStoreAccessToken(userId, tenantId) {
  return signJwt({ sub: userId, tenantId, roles: ["STORE_ADMIN"] }, { expiresInSeconds: storeAccessTokenMaxAgeSeconds });
}

function requireField(value, message) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
}

export async function registerStoreAccount(payload = {}) {
  const storeName = requireField(payload.storeName, "Дэлгүүрийн нэрээ оруулна уу.");
  const ownerName = requireField(payload.ownerName, "Эзэмшигчийн нэрээ оруулна уу.");
  const address = requireField(payload.address, "Хаягаа оруулна уу.");
  const phone = requireField(payload.phone, "Утасны дугаараа оруулна уу.");
  const username = normalizeStoreLoginId(payload.username);
  const password = String(payload.password ?? "");

  if (!username || (!username.includes("@") && !isPhoneNumber(username))) {
    const error = new Error("Нэвтрэх ID утасны дугаар эсвэл Gmail хаяг байх ёстой.");
    error.statusCode = 400;
    throw error;
  }

  validateStrongPassword(password);

  const isEmail = username.includes("@");
  const existing = await prisma.user.findFirst({ where: isEmail ? { email: username } : { phone: username } });
  if (existing) {
    const error = new Error("Энэ нэвтрэх ID бүртгэлтэй байна.");
    error.statusCode = 409;
    throw error;
  }

  const slugSuffix = Date.now().toString(36);
  const result = await prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.create({
      data: { name: storeName, slug: `${slugify(storeName)}-${slugSuffix}`, status: "TRIALING" },
    });

    const store = await transaction.store.create({
      data: { tenantId: tenant.id, name: storeName, slug: `${slugify(storeName)}-${slugSuffix}` },
    });

    const user = await transaction.user.create({
      data: {
        fullName: ownerName,
        email: isEmail ? username : null,
        phone: isEmail ? phone : username,
        passwordHash: hashPassword(password),
        tenantMemberships: { create: { tenantId: tenant.id, role: "STORE_ADMIN" } },
      },
    });

    return { tenant, store, user };
  });

  return {
    userId: result.user.id,
    tenantId: result.tenant.id,
    accessToken: createStoreAccessToken(result.user.id, result.tenant.id),
    store: { id: result.store.id, name: result.store.name },
  };
}

export async function loginStoreAccount(payload = {}) {
  const username = normalizeStoreLoginId(payload.username ?? payload.login);
  const password = String(payload.password ?? "");

  if (!username || !password) {
    const error = new Error("Нэвтрэх ID болон нууц үгээ оруулна уу.");
    error.statusCode = 400;
    throw error;
  }

  const isEmail = username.includes("@");
  const user = await prisma.user.findFirst({
    where: isEmail ? { email: username } : { phone: username },
    include: { tenantMemberships: { where: { role: "STORE_ADMIN" } } },
  });

  const membership = user?.tenantMemberships[0];
  if (!user || !membership || !verifyPassword(password, user.passwordHash)) {
    const error = new Error("Нэвтрэх ID эсвэл нууц үг буруу байна.");
    error.statusCode = 401;
    throw error;
  }

  const store = await prisma.store.findFirst({ where: { tenantId: membership.tenantId } });

  return {
    userId: user.id,
    tenantId: membership.tenantId,
    accessToken: createStoreAccessToken(user.id, membership.tenantId),
    store: store ? { id: store.id, name: store.name } : null,
  };
}

const defaultStoreLocation = { lat: 47.91785, lng: 106.93528 };
const offerTimeoutMs = 10_000;
const maxStoreOfferAttempts = 5;
const busyAssignmentWindowMs = 2 * 60 * 60 * 1000;
const storeSubscriptionPlanCode = "store-monthly-50000";
const storeSubscriptionAmountMnt = 50_000;
const storeSubscriptionInvoiceTtlMs = 15 * 60 * 1000;
const pendingSubscriptionInvoices = new Map();
const activeAssignmentStatuses = [
  "ACCEPTED",
  "ARRIVING_PICKUP",
  "PICKUP_VERIFICATION",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVING_DROPOFF",
];
const routeProfiles = {
  WALK: {
    mode: "WALKING",
    speedKmh: 4.8,
    networkFactor: 1.18,
    turnPenaltyMinutes: 1,
    label: "Явган замаар хамгийн ойр",
  },
  MOPED: {
    mode: "MOPED_ROAD",
    speedKmh: 24,
    networkFactor: 1.28,
    turnPenaltyMinutes: 2,
    label: "Мопедоор хамгийн ойр авто зам",
  },
  CAR: {
    mode: "AUTO_ROAD",
    speedKmh: 34,
    networkFactor: 1.38,
    turnPenaltyMinutes: 3,
    label: "Машинаар хамгийн хурдан авто зам",
  },
};

function dispatchRule(weightKg, distanceKm) {
  if (weightKg > 12 || distanceKm > 8) return { requiredVehicle: "CAR", eligibleVehicles: ["CAR"] };
  if (weightKg > 4 || distanceKm > 3) return { requiredVehicle: "MOPED", eligibleVehicles: ["MOPED", "CAR"] };
  return { requiredVehicle: "WALK", eligibleVehicles: ["WALK", "MOPED", "CAR"] };
}

function subscriptionIsActive(subscription, tenant) {
  if (tenant?.status === "ACTIVE") return true;
  if (!subscription) return false;
  if (subscription.status !== "ACTIVE") return false;
  return !subscription.endsAt || subscription.endsAt > new Date();
}

function formatSubscription(subscription, tenant) {
  const active = subscriptionIsActive(subscription, tenant);
  return {
    active,
    status: active ? "ACTIVE" : tenant?.status ?? subscription?.status ?? "PAST_DUE",
    planName: subscription?.plan?.name ?? "Store monthly",
    amountMnt: storeSubscriptionAmountMnt,
    startsAt: subscription?.startsAt?.toISOString?.() ?? null,
    endsAt: subscription?.endsAt?.toISOString?.() ?? null,
  };
}

async function loadStoreSubscription(tenantId) {
  const [tenant, subscription] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.subscription.findFirst({
      where: { tenantId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return formatSubscription(subscription, tenant);
}

async function assertStoreSubscriptionActive(tenantId) {
  const subscription = await loadStoreSubscription(tenantId);
  if (subscription.active) return;

  const error = new Error("Store эрх идэвхгүй байна. Сарын төлбөрөө төлж идэвхжүүлнэ үү.");
  error.statusCode = 402;
  error.code = "STORE_SUBSCRIPTION_REQUIRED";
  throw error;
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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

function routeProfileForVehicle(vehicleType) {
  return routeProfiles[String(vehicleType ?? "WALK").toUpperCase()] ?? routeProfiles.WALK;
}

function estimateRouteSegment(from, to, profile) {
  const directKm = haversineKm(from, to);
  const routeKm = directKm * profile.networkFactor;
  const minutes = Math.max(1, Math.round((routeKm / profile.speedKmh) * 60 + profile.turnPenaltyMinutes));
  return {
    directKm,
    routeKm,
    minutes,
  };
}

function pickupLocation(order) {
  return defaultStoreLocation;
}

function dropoffLocation(order, pickup, distanceKm) {
  return {
    lat: toNumber(order.customerAddress?.latitude, pickup.lat + distanceKm / 111),
    lng: toNumber(order.customerAddress?.longitude, pickup.lng + distanceKm / 74),
  };
}

function latestAssignmentLocation(assignment) {
  const location = assignment?.trackingSessions?.[0]?.locations?.[0];
  if (!location) return null;

  return {
    lat: toNumber(location.latitude, defaultStoreLocation.lat),
    lng: toNumber(location.longitude, defaultStoreLocation.lng),
  };
}

function latestEmployeeLocation(employee) {
  const location = employee?.assignments?.[0]?.trackingSessions?.[0]?.locations?.[0];
  if (!location) return null;

  return {
    lat: toNumber(location.latitude, defaultStoreLocation.lat),
    lng: toNumber(location.longitude, defaultStoreLocation.lng),
  };
}

function routePlanFor(order, employee, distanceKm, courierLocation = null) {
  const pickup = pickupLocation(order);
  const dropoff = dropoffLocation(order, pickup, distanceKm);
  const courier = courierLocation ?? latestEmployeeLocation(employee);
  if (!courier) return null;

  const profile = routeProfileForVehicle(employee?.vehicleType);
  const pickupRoute = estimateRouteSegment(courier, pickup, profile);
  const deliveryRoute = estimateRouteSegment(pickup, dropoff, profile);
  const totalKm = pickupRoute.routeKm + deliveryRoute.routeKm;
  const walkingMinutes = Math.max(4, Math.round(totalKm * 13));
  const mopedMinutes = Math.max(3, Math.round((totalKm / routeProfiles.MOPED.speedKmh) * 60 + routeProfiles.MOPED.turnPenaltyMinutes));
  const drivingMinutes = Math.max(3, Math.round((totalKm / routeProfiles.CAR.speedKmh) * 60 + routeProfiles.CAR.turnPenaltyMinutes));
  const etaMinutes = pickupRoute.minutes + deliveryRoute.minutes;

  return {
    engine: "A*/Dijkstra-style multimodal weighted routing estimator",
    routingMode: profile.mode,
    pickup,
    dropoff,
    courier,
    toPickupKm: Number(pickupRoute.routeKm.toFixed(2)),
    toPickupMinutes: pickupRoute.minutes,
    totalKm: Number(totalKm.toFixed(2)),
    walkingMinutes,
    mopedMinutes,
    drivingMinutes,
    fastestMode: profile.mode,
    etaMinutes,
    label: profile.label,
  };
}

async function liveLocationForEmployee(employee) {
  const cached = await appCache.get(`courier:live-location:${employee.id}`);
  if (cached?.lat == null || cached?.lng == null) return latestEmployeeLocation(employee);

  const lat = Number(cached.lat);
  const lng = Number(cached.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return latestEmployeeLocation(employee);

  return { lat, lng };
}

async function selectNearestEmployee(order, employees, distanceKm) {
  const ranked = await rankNearbyEmployees(order, employees, distanceKm);
  return ranked[0] ?? null;
}

async function rankNearbyEmployees(order, employees, distanceKm) {
  const ranked = await Promise.all(employees.map(async (employee) => {
    const liveLocation = await liveLocationForEmployee(employee);
    const routePlan = liveLocation ? routePlanFor(order, employee, distanceKm, liveLocation) : null;
    return {
      employee,
      routePlan,
      score: routePlan?.toPickupMinutes ?? routePlan?.toPickupKm ?? Number.POSITIVE_INFINITY,
      hasLiveLocation: Boolean(liveLocation),
    };
  }));

  return ranked.sort((left, right) => (
    Number(right.hasLiveLocation) - Number(left.hasLiveLocation)
    || left.score - right.score
  ));
}

function orderWeightKg(order) {
  const grams = (order.items ?? []).reduce((sum, item) => {
    const weight = item.variant?.weightGrams ?? 500;
    return sum + weight * item.quantity;
  }, 0);

  return Math.max(1, Math.ceil(grams / 1000));
}

function orderDistanceKm(order) {
  const pickup = pickupLocation(order);
  const dropoff = dropoffLocation(order, pickup, 2.4);
  return Number(haversineKm(pickup, dropoff).toFixed(1)) || 2.4;
}

function busyAssignmentWhere() {
  return {
    status: { in: ["OFFERED", ...activeAssignmentStatuses] },
    createdAt: { gte: new Date(Date.now() - busyAssignmentWindowMs) },
  };
}

async function offerWindowForOrder(transaction, orderId) {
  const [latestDispatchStart, latestReadyReset] = await Promise.all([
    transaction.orderStatusHistory.findFirst({
      where: { orderId, status: "COURIER_ASSIGNED" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    transaction.orderStatusHistory.findFirst({
      where: { orderId, status: "READY_FOR_PICKUP" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const activeDispatchStart = latestDispatchStart
    && (!latestReadyReset || latestDispatchStart.createdAt > latestReadyReset.createdAt)
    ? latestDispatchStart.createdAt
    : null;

  return {
    orderId,
    employeeId: { not: null },
    ...(activeDispatchStart ? { createdAt: { gte: activeDispatchStart } } : { createdAt: { gt: new Date() } }),
  };
}

async function previousOfferEmployeeIds(transaction, orderId) {
  const previousOffers = await transaction.deliveryAssignment.findMany({
    where: await offerWindowForOrder(transaction, orderId),
    select: { employeeId: true },
    orderBy: { createdAt: "asc" },
  });

  return previousOffers.map((offer) => offer.employeeId).filter(Boolean);
}

async function findAvailableEmployeesForOffer(transaction, { tenantId, vehicleTypes, excludedEmployeeIds = [] }) {
  const whereFor = ({ tenantScoped, vehicleOnly }) => ({
    ...(tenantScoped && tenantId ? { tenantId } : {}),
    online: true,
    verificationStatus: "ACTIVE",
    ...(vehicleOnly ? { vehicleType: { in: vehicleTypes } } : {}),
    ...(excludedEmployeeIds.length ? { id: { notIn: excludedEmployeeIds } } : {}),
    assignments: {
      none: busyAssignmentWhere(),
    },
  });

  const steps = [
    whereFor({ tenantScoped: true, vehicleOnly: true }),
    whereFor({ tenantScoped: true, vehicleOnly: false }),
    whereFor({ tenantScoped: false, vehicleOnly: true }),
    whereFor({ tenantScoped: false, vehicleOnly: false }),
  ];

  for (const where of steps) {
    const employees = await transaction.deliveryEmployee.findMany({
      where,
      include: {
        user: true,
        assignments: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            trackingSessions: {
              take: 1,
              orderBy: { startedAt: "desc" },
              include: { locations: { take: 1, orderBy: { recordedAt: "desc" } } },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (employees.length) return employees;
  }

  return [];
}

async function findAvailableEmployeesAllowingRetry(transaction, { tenantId, vehicleTypes, excludedEmployeeIds = [] }) {
  const employees = await findAvailableEmployeesForOffer(transaction, { tenantId, vehicleTypes, excludedEmployeeIds });
  if (employees.length || !excludedEmployeeIds.length) return employees;

  return findAvailableEmployeesForOffer(transaction, { tenantId, vehicleTypes, excludedEmployeeIds: [] });
}

async function createNextStoreCourierOffer(transaction, { tenantId, orderId }) {
  const order = await transaction.order.findFirst({
    where: { id: orderId, tenantId },
    include: { store: true, branch: true, customerAddress: true, items: { include: { variant: true } } },
  });

  if (!order) return null;

  const excludedEmployeeIds = await previousOfferEmployeeIds(transaction, orderId);
  if (excludedEmployeeIds.length >= maxStoreOfferAttempts) return null;

  const weightKg = orderWeightKg(order);
  const distanceKm = orderDistanceKm(order);
  const rule = dispatchRule(weightKg, distanceKm);
  const candidates = await findAvailableEmployeesForOffer(transaction, {
    tenantId,
    vehicleTypes: rule.eligibleVehicles,
    excludedEmployeeIds,
  });
  const rankedEmployees = await rankNearbyEmployees(order, candidates, distanceKm);
  const nextEmployee = rankedEmployees[0]?.employee;

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

async function advanceExpiredStoreOffers(tenantId) {
  const cutoff = new Date(Date.now() - offerTimeoutMs);
  const expiredOffers = await prisma.deliveryAssignment.findMany({
    where: {
      tenantId,
      status: "OFFERED",
      employeeId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderId: true },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  let changed = false;

  for (const offer of expiredOffers) {
    const result = await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.deliveryAssignment.updateMany({
        where: { id: offer.id, status: "OFFERED", createdAt: { lt: cutoff } },
        data: { status: "REJECTED" },
      });

      if (updateResult.count !== 1) return false;

      await transaction.deliveryAttempt.create({
        data: {
          assignmentId: offer.id,
          reason: "OFFER_TIMEOUT",
          note: "Store dashboard advanced the offer to the next online courier after 10 seconds.",
        },
      });

      const activeAssignment = await transaction.deliveryAssignment.findFirst({
        where: { orderId: offer.orderId, ...busyAssignmentWhere() },
        select: { id: true },
      });

      if (activeAssignment) return true;

      const nextOffer = await createNextStoreCourierOffer(transaction, { tenantId, orderId: offer.orderId });

      if (!nextOffer) {
        await transaction.order.update({
          where: { id: offer.orderId },
          data: { status: "READY_FOR_PICKUP" },
        });
        await transaction.orderStatusHistory.create({
          data: {
            orderId: offer.orderId,
            status: "READY_FOR_PICKUP",
            note: "5 active employees did not accept the delivery offer. Store can call delivery again.",
          },
        });
      }

      return true;
    });

    changed = changed || result;
  }

  return changed;
}

function formatAssignmentTracking(order) {
  const assignments = order.deliveryAssignments ?? [];
  const assignment = assignments.find((item) => activeAssignmentStatuses.includes(item.status))
    ?? assignments.find((item) => item.status === "OFFERED")
    ?? assignments[0];
  if (!assignment) return null;

  const courierLocation = latestAssignmentLocation(assignment);
  const firstRoute = routePlanFor(order, assignment.employee, 2, courierLocation);
  const routePlan = firstRoute ? (routePlanFor(order, assignment.employee, firstRoute.totalKm || 2, courierLocation) ?? firstRoute) : null;
  const statusLabels = {
    OFFERED: "Ойрын хүргэлтийн ажилтанд санал илгээгдсэн",
    ACCEPTED: "Хүргэлтийн ажилтан дэлгүүр рүү ирж байна",
    ARRIVING_PICKUP: "Хүргэлтийн ажилтан дэлгүүр рүү ойртож байна",
    PICKUP_VERIFICATION: "Дэлгүүр дээр ирсэн, бараа авах баталгаажуулалт хүлээж байна",
    PICKED_UP: "Бараа аваад хүргэлтэнд гарсан",
    IN_TRANSIT: "Хэрэглэгч рүү хүргэж байна",
    ARRIVING_DROPOFF: "Хүлээн авагчид ойртож байна",
    DELIVERED: "Захиалга дууссан",
    REJECTED: "Санал татгалзсан, дараагийн ажилтан руу шилжинэ",
  };

  return {
    assignmentId: assignment.id,
    status: assignment.status,
    statusLabel: statusLabels[assignment.status] ?? assignment.status,
    courier: assignment.employee
      ? {
          id: assignment.employee.id,
          name: assignment.employee.user?.fullName ?? "Хүргэлтийн ажилтан",
          vehicleType: assignment.employee.vehicleType ?? "WALK",
        }
      : null,
    acceptedAt: assignment.acceptedAt,
    createdAt: assignment.createdAt,
    routePlan,
  };
}

export async function getStoreDashboard(tenantId) {
  if (tenantId && await advanceExpiredStoreOffers(tenantId)) {
    appCache.clearByPrefix(`store:dashboard:${tenantId}`);
    appCache.clearByPrefix("courier:dashboard:");
    appCache.clearByPrefix("customer:tracking:");
    appCache.del("admin:dashboard");
  }

  return appCache.remember(`store:dashboard:${tenantId}`, () => loadStoreDashboard(tenantId), 2_000);
}

async function loadStoreDashboard(tenantId) {
  const [orders, review, subscription] = await Promise.all([
    listRecentOrdersByTenant(tenantId, { limit: 10 }),
    findEmployeeInAdminReview(tenantId),
    loadStoreSubscription(tenantId),
  ]);
  const activeOrder = orders[0];

  return {
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      amountMnt: order.totalMnt.toString(),
      deliveryTracking: formatAssignmentTracking(order),
      district: order.customerAddress?.label ?? "Хаяг сонгогдоогүй байна",
    })),
    activeOrder: activeOrder
      ? {
          id: activeOrder.id,
          note: "Ачаа авах баталгаажуулалт хүлээгдэж байна.",
          amountMnt: activeOrder.totalMnt.toString(),
        }
      : null,
    subscription,
    review: review
      ? {
          employeeCode: review.id,
          identityState: "Бичиг баримтын шалгалт",
          faceState: review.verificationStatus,
        }
      : null,
  };
}

export async function getStoreSubscription(tenantId) {
  return loadStoreSubscription(tenantId);
}

async function ensureStoreSubscriptionPlan(transaction = prisma) {
  return transaction.subscriptionPlan.upsert({
    where: { code: storeSubscriptionPlanCode },
    update: {
      monthlyPriceMnt: BigInt(storeSubscriptionAmountMnt),
      isActive: true,
    },
    create: {
      code: storeSubscriptionPlanCode,
      name: "Store monthly",
      monthlyPriceMnt: BigInt(storeSubscriptionAmountMnt),
      maxStoreUsers: 5,
      maxCouriers: 10,
      maxMonthlyOrders: 500,
      features: {
        dashboard: true,
        orders: true,
        products: true,
        delivery: true,
      },
    },
  });
}

export async function createStoreSubscriptionInvoice(tenantId) {
  if (!tenantId) {
    const error = new Error("Store tenant олдсонгүй.");
    error.statusCode = 401;
    throw error;
  }

  if (!isQpayConfigured()) {
    const error = new Error("QPay тохиргоо дутуу байна. Store service env-ээ шалгана уу.");
    error.statusCode = 500;
    error.code = "QPAY_NOT_CONFIGURED";
    throw error;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    const error = new Error("Store tenant олдсонгүй.");
    error.statusCode = 404;
    throw error;
  }

  const invoiceNo = `SUB${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const qpayInvoice = await createQpayInvoice({
    invoiceNo,
    amountMnt: storeSubscriptionAmountMnt,
    description: `DeliverHub сарын эрх ${tenant.name}`,
    receiverCode: tenant.slug,
  });

  const payment = {
    orderNo: invoiceNo,
    invoiceId: qpayInvoice.providerInvoiceId,
    amountMnt: storeSubscriptionAmountMnt,
    qrText: qpayInvoice.qrText,
    qrImage: qpayInvoice.qrImage,
    shortUrl: qpayInvoice.shortUrl,
    urls: qpayInvoice.urls,
    expiresAt: new Date(Date.now() + storeSubscriptionInvoiceTtlMs).toISOString(),
  };

  pendingSubscriptionInvoices.set(qpayInvoice.providerInvoiceId, {
    tenantId,
    invoiceNo,
    amountMnt: storeSubscriptionAmountMnt,
    createdAt: Date.now(),
  });

  return {
    subscription: await loadStoreSubscription(tenantId),
    payment,
  };
}

export async function checkStoreSubscriptionPayment(tenantId, payload = {}) {
  const invoiceId = String(payload.invoice_id ?? payload.invoiceId ?? "").trim();
  if (!invoiceId) {
    const error = new Error("QPay invoice дугаар ирсэнгүй.");
    error.statusCode = 400;
    throw error;
  }

  const pendingInvoice = pendingSubscriptionInvoices.get(invoiceId);
  if (!pendingInvoice) {
    const error = new Error("QPay invoice бүртгэл олдсонгүй. Invoice-ээ дахин үүсгэнэ үү.");
    error.statusCode = 404;
    throw error;
  }

  if (pendingInvoice && pendingInvoice.tenantId !== tenantId) {
    const error = new Error("QPay invoice энэ дэлгүүрт хамаарахгүй байна.");
    error.statusCode = 403;
    throw error;
  }

  const paymentCheck = await checkQpayInvoice(invoiceId);
  if (!paymentCheck.paid) {
    return {
      success: false,
      status: "PENDING",
      message: "Төлбөр хараахан баталгаажаагүй байна.",
      subscription: await loadStoreSubscription(tenantId),
    };
  }

  const now = new Date();
  const endsAt = new Date(now.getTime());
  endsAt.setMonth(endsAt.getMonth() + 1);

  await prisma.$transaction(async (transaction) => {
    const plan = await ensureStoreSubscriptionPlan(transaction);
    await transaction.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    });
    await transaction.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: "ACTIVE",
        startsAt: now,
        endsAt,
      },
    });
  });

  pendingSubscriptionInvoices.delete(invoiceId);
  appCache.clearByPrefix(`store:dashboard:${tenantId}`);

  return {
    success: true,
    status: "PAID",
    message: "Үйлчилгээний эрх амжилттай идэвхжлээ.",
    subscription: await loadStoreSubscription(tenantId),
  };
}

export async function requestStoreDelivery(tenantId, payload = {}) {
  await assertStoreSubscriptionActive(tenantId);

  const weightKg = Number(payload.weightKg ?? 1);
  const distanceKm = Number(payload.distanceKm ?? 2);

  if (tenantId && await advanceExpiredStoreOffers(tenantId)) {
    appCache.clearByPrefix(`store:dashboard:${tenantId}`);
    appCache.clearByPrefix("courier:dashboard:");
    appCache.clearByPrefix("customer:tracking:");
    appCache.del("admin:dashboard");
  }

  const order = await findDispatchOrder(tenantId, payload.orderId) ?? await findLatestDispatchableOrder(tenantId);
  const rule = dispatchRule(weightKg, distanceKm);

  if (!order) {
    const error = new Error("Хүргэлт дуудах бодит захиалга олдсонгүй.");
    error.statusCode = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  const existingActiveAssignment = await findBusyAssignmentForOrder(order.id);
  if (existingActiveAssignment) {
    const error = new Error("Энэ захиалгад аль хэдийн идэвхтэй хүргэлтийн ажил байна.");
    error.statusCode = 409;
    error.code = "ALREADY_DISPATCHED";
    throw error;
  }

  const dispatchTenantId = order.tenantId ?? tenantId;
  const excludedEmployeeIds = await previousOfferEmployeeIds(prisma, order.id);
  const tenantEmployees = await listMatchingEmployees(dispatchTenantId, rule.eligibleVehicles);
  const allEmployees = await listMatchingEmployeesAnyTenant(rule.eligibleVehicles);
  const employeeById = new Map([...tenantEmployees, ...allEmployees].map((employee) => [employee.id, employee]));
  const availableEmployees = [...employeeById.values()];
  let eligibleEmployees = availableEmployees.filter((employee) => !excludedEmployeeIds.includes(employee.id));
  if (!eligibleEmployees.length && availableEmployees.length) {
    eligibleEmployees = availableEmployees;
  }
  if (!eligibleEmployees.length) {
    eligibleEmployees = await prisma.$transaction((transaction) => findAvailableEmployeesAllowingRetry(transaction, {
      tenantId: dispatchTenantId,
      vehicleTypes: rule.eligibleVehicles,
      excludedEmployeeIds,
    }));
  }
  const rankedEmployees = await rankNearbyEmployees(order, eligibleEmployees, distanceKm);
  const nearest = rankedEmployees[0] ?? await selectNearestEmployee(order, eligibleEmployees, distanceKm);
  if (!nearest?.employee?.id) {
    const error = new Error("Хүргэлтийн ажилтан олдсонгүй.");
    error.statusCode = 409;
    error.code = "NO_COURIER_AVAILABLE";
    throw error;
  }
  const assignment = await createDeliveryOffer(dispatchTenantId, order.id, nearest.employee.id);
  const routePlan = nearest.routePlan;
  await updateOrderStatus(dispatchTenantId, order.id, "COURIER_ASSIGNED", "Дэлгүүр хүргэлт дуудлаа.");

  appCache.clearByPrefix(`store:dashboard:${dispatchTenantId}`);
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");

  return {
    assignmentId: assignment.id,
    orderId: order.id,
    createdAt: assignment.createdAt,
    storeName: order.store.name,
    weightKg,
    distanceKm,
    requiredVehicle: rule.requiredVehicle,
    requiredVehicleLabel: vehicleLabels[rule.requiredVehicle],
    eligibleEmployeeCount: Math.min(rankedEmployees.length, maxStoreOfferAttempts),
    dispatchQueue: rankedEmployees.slice(0, maxStoreOfferAttempts).map(({ employee, routePlan: candidateRoute }, index) => ({
      employeeId: employee.id,
      name: employee.user?.fullName ?? "Хүргэлтийн ажилтан",
      queueIndex: index + 1,
      toPickupKm: candidateRoute?.toPickupKm ?? null,
      etaMinutes: candidateRoute?.etaMinutes ?? null,
      location: candidateRoute?.courier,
    })),
    nearbyCouriers: rankedEmployees.slice(0, maxStoreOfferAttempts).map(({ employee, routePlan: candidateRoute }, index) => ({
      employeeId: employee.id,
      name: employee.user?.fullName ?? "Хүргэлтийн ажилтан",
      vehicleType: employee.vehicleType,
      queueIndex: index + 1,
      toPickupKm: candidateRoute?.toPickupKm ?? null,
      etaMinutes: candidateRoute?.etaMinutes ?? null,
      location: candidateRoute?.courier,
    })),
    nearestCourier: nearest
      ? {
          employeeId: nearest.employee.id,
          name: nearest.employee.user?.fullName ?? "Хүргэлтийн ажилтан",
          vehicleType: nearest.employee.vehicleType,
          toPickupKm: routePlan?.toPickupKm ?? null,
          etaMinutes: routePlan?.etaMinutes ?? null,
        }
      : null,
    routePlan,
    message: nearest
      ? `${nearest.employee.user?.fullName ?? "Ойрын ажилтан"} руу хүргэлтийн санал илгээлээ.${routePlan?.etaMinutes ? ` ETA ${routePlan.etaMinutes} мин.` : ""}`
      : "Хүргэлтийн ажилтан олдсонгүй. Дуудлага queue-д үлдлээ.",
  };
}

// Once a courier has been dispatched and moved past ACCEPTED (arrived at
// store, picked up, etc.), the order's own "confirm"/"prepared" actions must
// no longer be able to run - the courier/assignment side already owns the
// order status from here on. Without this guard, a stale button still
// visible in an old browser tab (or a store owner clicking "Бэлтгэж дуссан"
// again) silently rewrites order.status backwards while the assignment is
// already ahead, leaving the two out of sync and the store OTP screen stuck.
async function assertOrderNotBeyondDispatch(tenantId, orderId) {
  const activeAssignment = await prisma.deliveryAssignment.findFirst({
    where: {
      orderId,
      tenantId,
      status: { in: ["PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF", "DELIVERED"] },
    },
  });

  if (activeAssignment) {
    const error = new Error("Хүргэлтийн ажилтан аль хэдийн ажлаа эхэлсэн тул захиалгын энэ төлөвийг өөрчлөх боломжгүй.");
    error.statusCode = 409;
    throw error;
  }
}

export async function acceptStoreOrder(tenantId, orderId) {
  await assertStoreSubscriptionActive(tenantId);
  await assertOrderNotBeyondDispatch(tenantId, orderId);

  const order = await updateOrderStatus(tenantId, orderId, "PREPARING", "Дэлгүүр захиалгыг хүлээж аваад бэлтгэж эхэллээ.");
  appCache.clearByPrefix(`store:dashboard:${tenantId}`);
  appCache.clearByPrefix("customer:tracking:");
  return {
    orderId: order.id,
    storeName: order.store.name,
    status: order.status,
    message: "Захиалга хүлээж авлаа.",
  };
}

export async function markStoreOrderPrepared(tenantId, orderId) {
  await assertStoreSubscriptionActive(tenantId);
  await assertOrderNotBeyondDispatch(tenantId, orderId);

  const order = await updateOrderStatus(tenantId, orderId, "READY_FOR_PICKUP", "Бараа бэлтгэж дууслаа.");
  appCache.clearByPrefix(`store:dashboard:${tenantId}`);
  appCache.clearByPrefix("customer:tracking:");
  return {
    orderId: order.id,
    storeName: order.store.name,
    status: order.status,
    message: "Бэлтгэж дууслаа.",
  };
}

export async function verifyStorePickup(tenantId, assignmentId, payload = {}) {
  await assertStoreSubscriptionActive(tenantId);

  const assignment = await verifyPickupOtpByStore(tenantId, assignmentId, payload.otp);
  appCache.clearByPrefix(`store:dashboard:${tenantId}`);
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");

  return {
    assignmentId: assignment.id,
    orderId: assignment.orderId,
    storeName: assignment.order.store.name,
    status: "PICKED_UP",
    message: "Захиалга хүргэлтэнд гарлаа.",
  };
}
