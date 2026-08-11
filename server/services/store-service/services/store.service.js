import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  countMatchingEmployees,
  createDeliveryOffer,
  findEmployeeInAdminReview,
  findDispatchOrder,
  listMatchingEmployees,
  listMatchingEmployeesAnyTenant,
  listRecentOrdersByTenant,
  updateOrderStatus,
  verifyPickupOtpByStore,
} from "../repositories/store.repository.js";

function createHttpError(statusCode, message, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const vehicleLabels = {
  WALK: "Явган хүргэлт",
  MOPED: "Мопед",
  CAR: "Машин",
};

const defaultStoreLocation = { lat: 47.9189, lng: 106.9176 };

function dispatchRule(weightKg, distanceKm) {
  if (weightKg > 12 || distanceKm > 8) return { requiredVehicle: "CAR", eligibleVehicles: ["CAR"] };
  if (weightKg > 4 || distanceKm > 3) return { requiredVehicle: "MOPED", eligibleVehicles: ["MOPED", "CAR"] };
  return { requiredVehicle: "WALK", eligibleVehicles: ["WALK", "MOPED", "CAR"] };
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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
  return {
    lat: toNumber(order.branch?.latitude, defaultStoreLocation.lat),
    lng: toNumber(order.branch?.longitude, defaultStoreLocation.lng),
  };
}

function dropoffLocation(order, pickup, distanceKm) {
  return {
    lat: toNumber(order.customerAddress?.latitude, pickup.lat + distanceKm / 111),
    lng: toNumber(order.customerAddress?.longitude, pickup.lng + distanceKm / 74),
  };
}

function routePlanFor(order, employee, distanceKm) {
  const pickup = pickupLocation(order);
  const dropoff = dropoffLocation(order, pickup, distanceKm);
  const courier = employee ? employeeLiveLocation(employee, pickup) : pickup;
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

function selectNearestEmployee(order, employees, distanceKm) {
  return employees
    .map((employee) => {
      const routePlan = routePlanFor(order, employee, distanceKm);
      return { employee, routePlan, score: routePlan.toPickupKm };
    })
    .sort((left, right) => left.score - right.score)[0] ?? null;
}

function rankNearbyEmployees(order, employees, distanceKm) {
  return employees
    .map((employee) => {
      const routePlan = routePlanFor(order, employee, distanceKm);
      return {
        employee,
        routePlan,
        score: routePlan.toPickupKm,
      };
    })
    .sort((left, right) => left.score - right.score);
}

function formatAssignmentTracking(order) {
  const assignment = order.deliveryAssignments?.[0];
  if (!assignment) return null;

  const firstRoute = routePlanFor(order, assignment.employee, 2);
  const routePlan = routePlanFor(order, assignment.employee, firstRoute.totalKm || 2);
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
  const order = await findDispatchOrder(tenantId, payload.orderId);

  if (!order) {
    throw createHttpError(404, "Хүргэлт үүсгэх захиалга олдсонгүй.", "NOT_FOUND");
  }

  const rule = dispatchRule(weightKg, distanceKm);
  const [eligibleEmployeeCount, sameTenantEmployees] = await Promise.all([
    countMatchingEmployees(tenantId, rule.eligibleVehicles),
    listMatchingEmployees(tenantId, rule.eligibleVehicles),
  ]);
  const eligibleEmployees = sameTenantEmployees.length ? sameTenantEmployees : await listMatchingEmployeesAnyTenant(rule.eligibleVehicles);
  const rankedEmployees = rankNearbyEmployees(order, eligibleEmployees, distanceKm);
  const nearest = rankedEmployees[0] ?? selectNearestEmployee(order, eligibleEmployees, distanceKm);
  const assignment = await createDeliveryOffer(tenantId, order.id, nearest?.employee.id ?? null);
  const routePlan = nearest?.routePlan ?? routePlanFor(order, null, distanceKm);
  await updateOrderStatus(tenantId, order.id, "COURIER_ASSIGNED", "Дэлгүүр хүргэлт дуудлаа.");

  appCache.clearByPrefix(`store:dashboard:${tenantId}`);
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");

  return {
    assignmentId: assignment.id,
    orderId: order.id,
    storeName: order.store.name,
    weightKg,
    distanceKm,
    requiredVehicle: rule.requiredVehicle,
    requiredVehicleLabel: vehicleLabels[rule.requiredVehicle],
    eligibleEmployeeCount: Math.max(eligibleEmployeeCount, eligibleEmployees.length),
    nearbyCouriers: rankedEmployees.slice(0, 8).map(({ employee, routePlan: candidateRoute }) => ({
      employeeId: employee.id,
      name: employee.user?.fullName ?? "Хүргэлтийн ажилтан",
      vehicleType: employee.vehicleType,
      toPickupKm: candidateRoute.toPickupKm,
      etaMinutes: candidateRoute.etaMinutes,
      location: candidateRoute.courier,
    })),
    nearestCourier: nearest
      ? {
          employeeId: nearest.employee.id,
          name: nearest.employee.user?.fullName ?? "Хүргэлтийн ажилтан",
          vehicleType: nearest.employee.vehicleType,
          toPickupKm: routePlan.toPickupKm,
          etaMinutes: routePlan.etaMinutes,
        }
      : null,
    routePlan,
    message: nearest
      ? `${nearest.employee.user?.fullName ?? "Ойрын ажилтан"} руу хүргэлтийн санал илгээлээ. ETA ${routePlan.etaMinutes} мин.`
      : "Онлайн, идэвхтэй хүргэлтийн ажилтан олдсонгүй. Дуудлага queue-д үлдлээ.",
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
