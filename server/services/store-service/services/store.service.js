import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import { prisma } from "@deliverhub/server-platform/database/prisma";
import {
  createDeliveryOffer,
  findEmployeeInAdminReview,
  findDispatchOrder,
  findLatestDispatchableOrder,
  listMatchingEmployees,
  listMatchingEmployeesAnyTenant,
  listRecentOrdersByTenant,
  updateOrderStatus,
  verifyPickupOtpByStore,
} from "../repositories/store.repository.js";

const vehicleLabels = {
  WALK: "Явган хүргэлт",
  MOPED: "Мопед",
  CAR: "Машин",
};

const defaultStoreLocation = { lat: 47.91785, lng: 106.93528 };
const offerTimeoutMs = 30_000;
const maxStoreOfferAttempts = 5;
const busyAssignmentWindowMs = 2 * 60 * 60 * 1000;
const activeAssignmentStatuses = [
  "ACCEPTED",
  "ARRIVING_PICKUP",
  "PICKUP_VERIFICATION",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVING_DROPOFF",
];

function dispatchRule(weightKg, distanceKm) {
  if (weightKg > 12 || distanceKm > 8) return { requiredVehicle: "CAR", eligibleVehicles: ["CAR"] };
  if (weightKg > 4 || distanceKm > 3) return { requiredVehicle: "MOPED", eligibleVehicles: ["MOPED", "CAR"] };
  return { requiredVehicle: "WALK", eligibleVehicles: ["WALK", "MOPED", "CAR"] };
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

  const toPickupKm = haversineKm(courier, pickup);
  const deliveryKm = haversineKm(pickup, dropoff);
  const totalKm = toPickupKm + deliveryKm;
  const walkingMinutes = Math.max(4, Math.round(totalKm * 13));
  const drivingMinutes = Math.max(3, Math.round(totalKm * 4.2 + 3));
  const fastestMode = drivingMinutes < walkingMinutes ? "AUTO_ROAD" : "WALKING";

  return {
    engine: "Haversine realtime geospatial scoring",
    pickup,
    dropoff,
    courier,
    toPickupKm: Number(toPickupKm.toFixed(2)),
    totalKm: Number(totalKm.toFixed(2)),
    walkingMinutes,
    drivingMinutes,
    fastestMode,
    etaMinutes: Math.min(walkingMinutes, drivingMinutes),
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
      score: routePlan?.toPickupKm ?? Number.POSITIVE_INFINITY,
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
  const candidates = await findAvailableEmployeesAllowingRetry(transaction, {
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
          note: "Store dashboard advanced the offer to the next online courier after 30 seconds.",
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
  const [orders, review] = await Promise.all([
    listRecentOrdersByTenant(tenantId, { limit: 10 }),
    findEmployeeInAdminReview(tenantId),
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
    review: review
      ? {
          employeeCode: review.id,
          identityState: "Бичиг баримтын шалгалт",
          faceState: review.verificationStatus,
        }
      : null,
  };
}

export async function requestStoreDelivery(tenantId, payload = {}) {
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
    eligibleEmployeeCount: eligibleEmployees.length,
    dispatchQueue: rankedEmployees.map(({ employee, routePlan: candidateRoute }) => ({
      employeeId: employee.id,
      name: employee.user?.fullName ?? "Хүргэлтийн ажилтан",
      toPickupKm: candidateRoute?.toPickupKm ?? null,
      etaMinutes: candidateRoute?.etaMinutes ?? null,
      location: candidateRoute?.courier,
    })),
    nearbyCouriers: rankedEmployees.slice(0, 8).map(({ employee, routePlan: candidateRoute }) => ({
      employeeId: employee.id,
      name: employee.user?.fullName ?? "Хүргэлтийн ажилтан",
      vehicleType: employee.vehicleType,
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

export async function acceptStoreOrder(tenantId, orderId) {
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
