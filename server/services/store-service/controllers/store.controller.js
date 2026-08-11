import { tenantIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import { storeEventBus } from "../messaging.js";
import { acceptStoreOrder, getStoreDashboard, markStoreOrderPrepared, requestStoreDelivery, verifyStorePickup } from "../services/store.service.js";

export async function showStoreDashboard(request, response) {
  response.json(await getStoreDashboard(tenantIdFromRequest(request)));
}

export async function createStoreDeliveryRequest(request, response) {
  const result = await requestStoreDelivery(tenantIdFromRequest(request), request.body);
  storeEventBus.publishSoon("delivery.request.created", {
    orderId: result.orderId,
    assignmentId: result.assignmentId,
    status: "COURIER_ASSIGNED",
    requiredVehicle: result.requiredVehicle,
    requiredVehicleLabel: result.requiredVehicleLabel,
    nearestCourier: result.nearestCourier,
    routePlan: result.routePlan,
  });
  response.status(201).json(result);
}

export async function acceptOrder(request, response) {
  const result = await acceptStoreOrder(tenantIdFromRequest(request), request.params.orderId);
  storeEventBus.publishSoon("order.status.updated", {
    orderId: result.orderId,
    storeName: result.storeName,
    status: result.status,
    message: result.message,
  });
  response.json(result);
}

export async function markOrderPrepared(request, response) {
  const result = await markStoreOrderPrepared(tenantIdFromRequest(request), request.params.orderId);
  storeEventBus.publishSoon("order.status.updated", {
    orderId: result.orderId,
    storeName: result.storeName,
    status: result.status,
    message: result.message,
  });
  response.json(result);
}

export async function verifyPickup(request, response) {
  const result = await verifyStorePickup(tenantIdFromRequest(request), request.params.assignmentId, request.body);
  storeEventBus.publishSoon("delivery.job.pickup_verified", {
    orderId: result.orderId,
    assignmentId: result.assignmentId,
    storeName: result.storeName,
    status: result.status,
    message: result.message,
  });
  response.json(result);
}
