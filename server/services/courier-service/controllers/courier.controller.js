import { userIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import { courierEventBus } from "../messaging.js";
import {
  acceptCourierJob,
  arriveCourierAtStore,
  getCourierDashboard,
  loginCourier,
  registerCourier,
  rejectCourierJob,
  setCourierOnlineStatus,
  verifyCourierCustomerOtp,
  submitCourierFace,
  submitCourierIdentity,
  verifyCourierStoreOtp,
} from "../services/courier.service.js";

export async function registerCourierAccount(request, response) {
  const result = await registerCourier(request.body);
  courierEventBus.publishSoon("courier.registered", { userId: result.userId });
  response.status(201).json(result);
}

export async function loginCourierAccount(request, response) {
  response.json(await loginCourier(request.body));
}

export async function showCourierDashboard(request, response) {
  response.json(await getCourierDashboard(userIdFromRequest(request)));
}

export async function verifyCourierIdentity(request, response) {
  const result = await submitCourierIdentity(userIdFromRequest(request), request.body);
  courierEventBus.publishSoon("courier.identity.updated", { userId: userIdFromRequest(request) });
  response.json(result);
}

export async function verifyCourierFace(request, response) {
  const result = await submitCourierFace(userIdFromRequest(request), request.body);
  courierEventBus.publishSoon("courier.face.updated", { userId: userIdFromRequest(request) });
  response.json(result);
}

export async function updateCourierStatus(request, response) {
  const result = await setCourierOnlineStatus(userIdFromRequest(request), request.body?.online);
  courierEventBus.publishSoon("courier.status.updated", { userId: userIdFromRequest(request), online: result.online });
  response.json(result);
}

export async function acceptCourierAssignment(request, response) {
  const result = await acceptCourierJob(userIdFromRequest(request), request.params.assignmentId);
  courierEventBus.publishSoon("delivery.job.accepted", { assignmentId: result.id, state: result.state });
  response.status(201).json(result);
}

export async function rejectCourierAssignment(request, response) {
  const result = await rejectCourierJob(userIdFromRequest(request), request.params.assignmentId);
  courierEventBus.publishSoon("delivery.job.rejected", { assignmentId: request.params.assignmentId });
  response.json(result);
}

export async function arriveCourierStore(request, response) {
  const result = await arriveCourierAtStore(userIdFromRequest(request), request.params.assignmentId);
  courierEventBus.publishSoon("delivery.job.arrived_store", { assignmentId: result.id, state: result.state });
  response.json(result);
}

export async function verifyCourierPickup(request, response) {
  const result = await verifyCourierStoreOtp(userIdFromRequest(request), request.params.assignmentId, request.body);
  courierEventBus.publishSoon("delivery.job.pickup_verified", { assignmentId: result.id, state: result.state });
  response.json(result);
}

export async function verifyCourierDropoff(request, response) {
  const result = await verifyCourierCustomerOtp(userIdFromRequest(request), request.params.assignmentId, request.body);
  courierEventBus.publishSoon("delivery.job.dropoff_verified", { assignmentId: result.id, state: result.state });
  response.json(result);
}
