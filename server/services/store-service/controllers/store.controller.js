import { tenantIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import { storeEventBus } from "../messaging.js";
import { getStoreDashboard, requestStoreDelivery } from "../services/store.service.js";

export async function showStoreDashboard(request, response) {
  response.json(await getStoreDashboard(tenantIdFromRequest(request)));
}

export async function createStoreDeliveryRequest(request, response) {
  const result = await requestStoreDelivery(tenantIdFromRequest(request), request.body);
  storeEventBus.publishSoon("delivery.request.created", {
    orderId: result.orderId,
    assignmentId: result.assignmentId,
    requiredVehicle: result.requiredVehicle,
    requiredVehicleLabel: result.requiredVehicleLabel,
  });
  response.status(201).json(result);
}
