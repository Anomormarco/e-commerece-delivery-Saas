import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  countMatchingEmployees,
  createDeliveryOffer,
  findEmployeeInAdminReview,
  findDispatchOrder,
  listRecentOrdersByTenant,
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

function dispatchRule(weightKg, distanceKm) {
  if (weightKg > 12 || distanceKm > 8) return { requiredVehicle: "CAR", eligibleVehicles: ["CAR"] };
  if (weightKg > 4 || distanceKm > 3) return { requiredVehicle: "MOPED", eligibleVehicles: ["MOPED", "CAR"] };
  return { requiredVehicle: "WALK", eligibleVehicles: ["WALK", "MOPED", "CAR"] };
}

export async function getStoreDashboard(tenantId) {
  return appCache.remember(`store:dashboard:${tenantId}`, () => loadStoreDashboard(tenantId), 10_000);
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
  const eligibleEmployeeCount = await countMatchingEmployees(tenantId, rule.eligibleVehicles);
  const assignment = await createDeliveryOffer(tenantId, order.id);

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
    eligibleEmployeeCount,
    message: `${vehicleLabels[rule.requiredVehicle]} төрлийн ажилтанд дуудлага илгээлээ.`,
  };
}
