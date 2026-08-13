import { userIdFromRequest } from "@deliverhub/server-platform/http/request-context";
import { courierEventBus } from "../messaging.js";
import {
  acceptCourierJob,
  arriveCourierAtStore,
  editCourierProfile,
  getCourierDashboard,
  loginCourier,
  registerCourier,
  rejectCourierJob,
  setCourierOnlineStatus,
  updateCourierLocation,
  verifyCourierCustomerOtp,
  submitCourierFace,
  submitCourierIdentity,
  verifyCourierStoreOtp,
} from "../services/courier.service.js";

function fallbackCourierDashboard(userId = "", online = true) {
  return {
    online,
    expectedEarningMnt: "0",
    employeeName: userId ? "Хүргэлтийн ажилтан" : "Ажилтан",
    vehicleType: "WALK",
    vehicleLabel: "Явган хүргэлт",
    jobs: [],
    verificationText: "Dashboard мэдээлэл түр уншигдсангүй. Дахин шинэчилнэ үү.",
    verificationStatus: "ACTIVE",
    degraded: true,
  };
}

export async function registerCourierAccount(request, response) {
  const result = await registerCourier(request.body);
  courierEventBus.publishSoon("courier.registered", { userId: result.userId });
  response.status(201).json(result);
}

export async function loginCourierAccount(request, response) {
  response.json(await loginCourier(request.body));
}

export async function showCourierDashboard(request, response) {
  const userId = userIdFromRequest(request);

  try {
    response.json(await getCourierDashboard(userId));
  } catch (error) {
    console.error("[courier-service] dashboard fallback", {
      userId,
      message: error?.message,
      code: error?.code,
    });
    response.json(fallbackCourierDashboard(userId));
  }
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
  if (typeof request.body?.online !== "boolean") {
    response.status(400).json({
      status: "error",
      statusCode: 400,
      message: "Ажлын төлөв буруу байна.",
      code: "BAD_REQUEST",
      service: "courier-service",
    });
    return;
  }

  const userId = userIdFromRequest(request);
  const nextOnline = request.body.online;

  try {
    const result = await setCourierOnlineStatus(userId, nextOnline);
    courierEventBus.publishSoon("courier.status.updated", { userId, online: result.online });
    response.json(result);
  } catch (error) {
    console.error("[courier-service] status fallback", {
      userId,
      online: nextOnline,
      message: error?.message,
      code: error?.code,
    });
    response.json(fallbackCourierDashboard(userId, nextOnline));
  }
}

export async function updateCourierPosition(request, response) {
  const result = await updateCourierLocation(userIdFromRequest(request), request.body);
  courierEventBus.publishSoon("courier.location.updated", {
    assignmentId: result.assignmentId,
    orderId: result.orderId,
  });
  response.json(result);
}

export async function updateCourierProfile(request, response) {
  const userId = userIdFromRequest(request);
  const result = await editCourierProfile(userId, request.body);
  courierEventBus.publishSoon("courier.profile.updated", { userId });
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
