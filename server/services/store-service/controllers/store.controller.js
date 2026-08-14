import { tenantIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import { storeEventBus } from "../messaging.js";
import {
  acceptStoreOrder,
  checkStoreSubscriptionPayment,
  createStoreSubscriptionInvoice,
  getStoreDashboard,
  getStoreSubscription,
  loginStoreAccount,
  markStoreOrderPrepared,
  registerStoreAccount,
  requestStoreDelivery,
  verifyStorePickup,
} from "../services/store.service.js";

export async function registerStore(request, response) {
  response.status(201).json(await registerStoreAccount(request.body));
}

export async function loginStore(request, response) {
  response.json(await loginStoreAccount(request.body));
}

export async function showStoreDashboard(request, response) {
  response.json(await getStoreDashboard(tenantIdFromRequest(request)));
}

export async function showStoreSubscription(request, response) {
  response.json(await getStoreSubscription(tenantIdFromRequest(request)));
}

export async function createSubscriptionInvoice(request, response) {
  response.status(201).json(await createStoreSubscriptionInvoice(tenantIdFromRequest(request)));
}

export async function checkSubscriptionPayment(request, response) {
  response.json(await checkStoreSubscriptionPayment(tenantIdFromRequest(request), request.body));
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
