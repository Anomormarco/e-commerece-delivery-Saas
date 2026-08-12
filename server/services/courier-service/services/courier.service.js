import { signJwt } from "@deliverhub/server-platform/http/jwt";
import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  hashPassword,
  normalizeCourierLoginId,
  normalizeGmailAddress,
  normalizePhone,
  validateStrongPassword,
  verifyPassword,
} from "@deliverhub/server-platform/auth/credentials";
import {
  acceptDeliveryAssignment,
  activateExistingCourierApplication,
  advanceExpiredCourierOffers,
  createCourierApplication,
  findCourierDashboardByUserId,
  findCourierByContact,
  findCourierByLoginId,
  markCourierArrivedAtStore,
  recordFaceVerification,
  recordIdentityVerification,
  recordLoginFaceVerification,
  recordCourierLocation,
  rejectDeliveryAssignment,
  updateCourierOnlineState,
  verifyCourierDropoffOtp,
  verifyCourierPickupOtp,
} from "../repositories/courier.repository.js";

const vehicleLabels = {
  WALK: "\u042F\u0432\u0433\u0430\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442",
  MOPED: "\u041C\u043E\u043F\u0435\u0434",
  CAR: "\u041C\u0430\u0448\u0438\u043D",
};

const courierAccessTokenMaxAgeSeconds = 60 * 60 * 24 * 30;
const courierOfferTimeoutMs = 10_000;

function createCourierAccessToken(employee) {
  return signJwt({
    sub: employee.userId,
    tenantId: employee.tenantId,
    roles: ["DELIVERY_EMPLOYEE"],
  }, { expiresInSeconds: courierAccessTokenMaxAgeSeconds });
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isPrismaUniqueError(error) {
  return error?.code === "P2002";
}

function assignmentWeightKg(assignment) {
  const items = assignment.order?.items ?? [];
  const grams = items.reduce((sum, item) => {
    const weight = item.variant?.weightGrams ?? 500;
    return sum + weight * Number(item.quantity ?? 0);
  }, 0);

  return Math.max(1, Math.ceil(grams / 1000));
}

function assignmentDistanceKm(assignment) {
  const pickup = pickupLocation(assignment.order ?? {});
  const dropoff = dropoffLocation(assignment.order ?? {}, pickup);
  return Number(haversineKm(pickup, dropoff).toFixed(1)) || (assignment.order?.customerAddressId ? 4.8 : 2.4);
}

const defaultStoreLocation = { lat: 47.91785, lng: 106.93528 };

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

function pickupAddress(order = {}) {
  return order.branch?.address ?? order.store?.name ?? "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440\u0438\u0439\u043D \u0431\u0430\u0439\u0440\u0448\u0438\u043B";
}

function dropoffAddress(order = {}) {
  return order.customerAddress?.address
    ?? order.customerAddress?.label
    ?? "\u0425\u04AF\u0440\u0433\u04AF\u04AF\u043B\u044D\u0445 \u0445\u0430\u044F\u0433 \u0431\u04AF\u0440\u0442\u0433\u044D\u0433\u0434\u044D\u044D\u0433\u04AF\u0439";
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

function assignmentRoutePlan(assignment) {
  const pickup = pickupLocation(assignment.order);
  const dropoff = dropoffLocation(assignment.order, pickup);
  const totalKm = haversineKm(pickup, dropoff);
  const walkingMinutes = Math.max(4, Math.round(totalKm * 13));
  const drivingMinutes = Math.max(3, Math.round(totalKm * 4.2 + 3));
  const fastestMode = drivingMinutes < walkingMinutes ? "AUTO_ROAD" : "WALKING";

  return {
    pickup,
    dropoff,
    totalKm: Number(totalKm.toFixed(2)),
    walkingMinutes,
    drivingMinutes,
    fastestMode,
    etaMinutes: Math.min(walkingMinutes, drivingMinutes),
    label: fastestMode === "AUTO_ROAD" ? "Авто замаар хамгийн хурдан" : "Явган хамгийн ойр зам",
  };
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

function verifiedDocumentFromPayload(payload) {
  const rawDocumentType = String(payload.documentType ?? "ID_CARD").toUpperCase();
  const documentType = rawDocumentType === "IDENTITY_CARD" ? "ID_CARD" : rawDocumentType;
  const hasDocumentFront = Boolean(payload.documentFront ?? payload.hasDocumentFront ?? payload.passportPhoto);
  const hasDocumentBack = documentType === "PASSPORT" || Boolean(payload.documentBack ?? payload.hasDocumentBack);

  return {
    documentType,
    hasDocumentFront,
    hasDocumentBack,
    passed: ["ID_CARD", "PASSPORT"].includes(documentType) && hasDocumentFront && hasDocumentBack,
  };
}

function verifiedFaceFromPayload(payload) {
  const selfieWithDocument = Boolean(payload.selfieWithDocument ?? payload.passportSelfie ?? payload.faceLoginConfirmed);
  const livenessConfirmed = Boolean(payload.livenessConfirmed ?? payload.faceLoginConfirmed);
  const documentFaceMatched = Boolean(payload.documentFaceMatched ?? payload.passportCompared);

  return {
    selfieWithDocument,
    livenessConfirmed,
    documentFaceMatched,
    passed: selfieWithDocument && livenessConfirmed && documentFaceMatched,
  };
}

function formatCourierDashboard(employee) {
  const vehicleType = employee.vehicleType ?? "WALK";
  const assignments = Array.isArray(employee.assignments) ? employee.assignments : [];
  const jobs = assignments
    .filter((assignment) => assignment?.order)
    .map((assignment) => {
      const weightKg = assignmentWeightKg(assignment);
      const distanceKm = assignmentDistanceKm(assignment);
      const requirement = requiredVehicle(weightKg, distanceKm);
      const routePlan = assignmentRoutePlan(assignment);

      return {
        id: assignment.id,
        state: assignment.status,
        name: assignment.order?.store?.name ?? "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440",
        pickupAddress: pickupAddress(assignment.order),
        dropoffAddress: dropoffAddress(assignment.order),
        distance: `${distanceKm.toFixed(1)} \u043A\u043C`,
        weightKg,
        requiredVehicle: requirement,
        requiredVehicleLabel: vehicleLabels[requirement],
        payoutMnt: String(5500 + Math.round(distanceKm * 900) + weightKg * 180),
        canAccept: assignment.employeeId === employee.id || canVehicleServe(vehicleType, requirement),
        offerExpiresInSec: assignment.status === "OFFERED"
          ? Math.max(0, Math.ceil((assignment.createdAt.getTime() + courierOfferTimeoutMs - Date.now()) / 1000))
          : null,
        routePlan,
      };
    })
    .filter((job) => job.state !== "OFFERED" || job.canAccept);

  return {
    online: Boolean(employee.online),
    expectedEarningMnt: employee.wallet?.balanceMnt?.toString() ?? "0",
    employeeName: employee.user?.fullName ?? "\u0410\u0436\u0438\u043B\u0442\u0430\u043D",
    vehicleType,
    vehicleLabel: vehicleLabels[vehicleType] ?? vehicleLabels.WALK,
    jobs,
    verificationText: `\u0411\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0443\u0443\u043B\u0430\u043B\u0442\u044B\u043D \u0442\u04E9\u043B\u04E9\u0432: ${employee.verificationStatus}`,
    verificationStatus: employee.verificationStatus,
  };
}

function formatCourierAssignment(assignment) {
  const weightKg = assignmentWeightKg(assignment);
  const distanceKm = assignmentDistanceKm(assignment);
  const requirement = requiredVehicle(weightKg, distanceKm);
  const routePlan = assignmentRoutePlan(assignment);

  return {
    id: assignment.id,
    state: assignment.status,
    name: assignment.order?.store?.name ?? "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440",
    pickupAddress: pickupAddress(assignment.order),
    dropoffAddress: dropoffAddress(assignment.order),
    distance: `${distanceKm.toFixed(1)} \u043A\u043C`,
    weightKg,
    requiredVehicle: requirement,
    requiredVehicleLabel: vehicleLabels[requirement],
    payoutMnt: String(5500 + Math.round(distanceKm * 900) + weightKg * 180),
    canAccept: true,
    offerExpiresInSec: assignment.status === "OFFERED"
      ? Math.max(0, Math.ceil((assignment.createdAt.getTime() + courierOfferTimeoutMs - Date.now()) / 1000))
      : null,
    routePlan,
  };
}

export async function registerCourier(payload = {}) {
  const fullName = String(payload.fullName ?? "").trim();
  const rawLoginId = payload.loginId ?? payload.phone ?? payload.email;
  const phone = payload.phone ? normalizePhone(payload.phone) : null;
  const email = payload.email ? normalizeGmailAddress(payload.email) : null;
  const password = String(payload.password ?? "");
  const vehicleType = String(payload.vehicleType ?? "WALK").toUpperCase();
  const vehiclePlate = String(payload.vehiclePlate ?? "").trim() || null;
  const legalName = String(payload.legalName ?? fullName).trim();
  const documentVerification = verifiedDocumentFromPayload(payload);
  const faceVerification = verifiedFaceFromPayload(payload);
  const applicationProfile = {
    firstName: String(payload.firstName ?? "").trim(),
    lastName: String(payload.lastName ?? "").trim(),
    age: payload.age ? Number(payload.age) : null,
    gender: String(payload.gender ?? "").trim(),
    homeAddress: String(payload.homeAddress ?? "").trim(),
    emergencyPhones: String(payload.emergencyPhones ?? "").trim(),
    phoneVerified: Boolean(payload.phoneVerified),
  };

  if (!fullName || !rawLoginId || !password) {
    throw createHttpError(400, "Нэр, утас эсвэл Gmail ID, нууц үг шаардлагатай.");
  }

  if (!applicationProfile.firstName || !applicationProfile.lastName || !applicationProfile.age || !applicationProfile.gender || !applicationProfile.homeAddress || !applicationProfile.emergencyPhones) {
    throw createHttpError(400, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0445\u0443\u0432\u0438\u0439\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B \u0434\u0443\u0442\u0443\u0443 \u0431\u0430\u0439\u043D\u0430.");
  }

  if (!applicationProfile.phoneVerified) {
    throw createHttpError(400, "\u0423\u0442\u0430\u0441\u043D\u044B \u0434\u0443\u0433\u0430\u0430\u0440 \u044D\u0445\u043B\u044D\u044D\u0434 \u0431\u0430\u0442\u0430\u043B\u0433\u0430\u0430\u0436\u0441\u0430\u043D \u0431\u0430\u0439\u0445 \u0451\u0441\u0442\u043E\u0439.");
  }

  if (!documentVerification.passed) {
    throw createHttpError(400, "\u0418\u0440\u0433\u044D\u043D\u0438\u0439 \u04AF\u043D\u044D\u043C\u043B\u044D\u0445 \u044D\u0441\u0432\u044D\u043B \u0433\u0430\u0434\u0430\u0430\u0434 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u044B\u043D \u0437\u0443\u0440\u0430\u0433 \u0434\u0443\u0442\u0443\u0443.");
  }

  if (!faceVerification.passed) {
    throw createHttpError(400, "\u0426\u0430\u0440\u0430\u0439 \u0442\u0430\u043D\u0438\u043B\u0442, \u0430\u043C\u044C\u0434 \u0445\u04AF\u043D \u0448\u0430\u043B\u0433\u0430\u043B\u0442, \u0431\u0438\u0447\u0438\u0433 \u0431\u0430\u0440\u0438\u043C\u0442\u0442\u0430\u0439 \u0442\u0430\u0430\u0440\u0441\u0430\u043D \u0448\u0430\u043B\u0433\u0430\u043B\u0442 \u0437\u0430\u0430\u0432\u0430\u043B \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439 \u0431\u0430\u0439\u0445 \u0451\u0441\u0442\u043E\u0439.");
  }

  const loginId = normalizeCourierLoginId(rawLoginId);
  validateStrongPassword(password);

  const existing = await findCourierByContact({ loginId, phone, email });
  if (existing?.verificationStatus === "ACTIVE") {
    if (verifyPassword(password, existing.user.passwordHash)) {
      return { userId: existing.userId, accessToken: createCourierAccessToken(existing), dashboard: formatCourierDashboard(existing) };
    }

    throw createHttpError(409, "Энэ утас эсвэл Gmail хаяг бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.");
  }

  const applicationData = {
    fullName,
    loginId,
    phone,
    email,
    passwordHash: hashPassword(password),
    vehicleType,
    vehiclePlate,
    applicationProfile,
    identityVerification: {
      legalName,
      documentType: documentVerification.documentType,
      documentFront: documentVerification.hasDocumentFront,
      documentBack: documentVerification.hasDocumentBack,
      source: "employee-register-step-2",
    },
    faceVerification: {
      selfieWithDocument: faceVerification.selfieWithDocument,
      livenessConfirmed: faceVerification.livenessConfirmed,
      documentFaceMatched: faceVerification.documentFaceMatched,
      faceAudit: payload.faceAudit ?? null,
      source: "employee-register-step-2",
    },
  };
  let employee;
  try {
    employee = existing
      ? await activateExistingCourierApplication({
          ...applicationData,
          employeeId: existing.id,
          userId: existing.userId,
        })
      : await createCourierApplication(applicationData);
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      throw createHttpError(409, "Утас эсвэл Gmail хаяг аль хэдийн бүртгэлтэй байна.");
    }
    throw error;
  }
  appCache.clearByPrefix("courier:dashboard:");
  appCache.del("admin:dashboard");
  return { userId: employee.userId, accessToken: createCourierAccessToken(employee), dashboard: formatCourierDashboard(employee) };
}

export async function updateCourierLocation(userId, payload = {}) {
  return recordCourierLocation(userId, payload);
}

export async function loginCourier(payload = {}) {
  const rawLoginId = payload.loginId ?? payload.phone ?? payload.email;
  const password = String(payload.password ?? "");
  const loginId = normalizeCourierLoginId(rawLoginId);
  const employee = await findCourierByLoginId(loginId);

  if (!employee || !verifyPassword(password, employee.user.passwordHash)) {
    throw createHttpError(401, "Курьерийн ID эсвэл нууц үг буруу байна.");
  }

  if (employee.verificationStatus !== "ACTIVE") {
    throw createHttpError(403, "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u0438\u0434\u044D\u0432\u0445\u0436\u044D\u044D\u0433\u04AF\u0439 \u0431\u0430\u0439\u043D\u0430.");
  }

  const loginFace = verifiedFaceFromPayload({ ...payload, documentFaceMatched: true });

  if (!loginFace.passed) {
    throw createHttpError(401, "\u041D\u044D\u0432\u0442\u0440\u044D\u0445\u0434\u044D\u044D \u0446\u0430\u0440\u0430\u0439 \u0442\u0430\u043D\u0438\u043B\u0442 \u0437\u0430\u0430\u0432\u0430\u043B \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439 \u0431\u0430\u0439\u0445 \u0451\u0441\u0442\u043E\u0439.");
  }

  const verifiedEmployee = await recordLoginFaceVerification(employee.userId, {
    selfieWithDocument: loginFace.selfieWithDocument,
    livenessConfirmed: loginFace.livenessConfirmed,
    faceAudit: payload.faceAudit ?? null,
    source: "employee-login",
  });

  return { userId: employee.userId, accessToken: createCourierAccessToken(employee), dashboard: formatCourierDashboard(verifiedEmployee) };
}

export async function submitCourierIdentity(userId, payload = {}) {
  const legalName = String(payload.legalName ?? "").trim();
  const documentType = String(payload.documentType ?? "ID_CARD");
  const documentFront = Boolean(payload.documentFront);
  const documentBack = documentType === "PASSPORT" ? true : Boolean(payload.documentBack);

  if (!userId || !legalName || !documentFront || !documentBack) {
    throw createHttpError(400, "\u0411\u0438\u0447\u0438\u0433 \u0431\u0430\u0440\u0438\u043C\u0442\u044B\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u044D\u043B \u0434\u0443\u0442\u0443\u0443.");
  }

  const dashboard = formatCourierDashboard(await recordIdentityVerification(userId, { legalName, documentType, documentFront, documentBack }));
  appCache.clearByPrefix(`courier:dashboard:${userId || "default"}`);
  appCache.del("admin:dashboard");
  return dashboard;
}

export async function submitCourierFace(userId, payload = {}) {
  if (!userId) {
    throw createHttpError(401, "\u041D\u044D\u0432\u0442\u0440\u044D\u044D\u0433\u04AF\u0439 \u0431\u0430\u0439\u043D\u0430.");
  }

  const dashboard = formatCourierDashboard(await recordFaceVerification(userId, payload));
  appCache.clearByPrefix(`courier:dashboard:${userId || "default"}`);
  appCache.del("admin:dashboard");
  return dashboard;
}

export async function getCourierDashboard(userId) {
  const advanced = await advanceExpiredCourierOffers();
  if (advanced.expiredCount || advanced.reofferedCount) {
    appCache.clearByPrefix("courier:dashboard:");
    appCache.clearByPrefix("store:dashboard:");
    appCache.clearByPrefix("customer:tracking:");
    appCache.del("admin:dashboard");
  }

  return loadCourierDashboard(userId);
}

async function loadCourierDashboard(userId) {
  const employee = await findCourierDashboardByUserId(userId);

  if (!employee) {
    return {
      online: false,
      expectedEarningMnt: "0",
      jobs: [],
      verificationText: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u04AF\u0440\u0442\u0433\u044D\u043B \u043E\u043B\u0434\u0441\u043E\u043D\u0433\u04AF\u0439.",
    };
  }

  return formatCourierDashboard(employee);
}

export async function setCourierOnlineStatus(userId, online) {
  const employee = await updateCourierOnlineState(userId, Boolean(online));
  appCache.clearByPrefix(`courier:dashboard:${userId || "default"}`);
  appCache.clearByPrefix("store:dashboard:");
  appCache.del("admin:dashboard");
  return employee ? formatCourierDashboard(employee) : getCourierDashboard(userId);
}

export async function acceptCourierJob(userId, assignmentId) {
  const assignment = await acceptDeliveryAssignment(userId, assignmentId);
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("store:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");

  return formatCourierAssignment(assignment);
}

export async function rejectCourierJob(userId, assignmentId) {
  appCache.clearByPrefix("courier:dashboard:");
  appCache.del("admin:dashboard");
  return formatCourierDashboard(await rejectDeliveryAssignment(userId, assignmentId));
}

export async function arriveCourierAtStore(userId, assignmentId) {
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");
  return formatCourierAssignment(await markCourierArrivedAtStore(userId, assignmentId));
}

export async function verifyCourierStoreOtp(userId, assignmentId, payload = {}) {
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");
  return formatCourierAssignment(await verifyCourierPickupOtp(userId, assignmentId, payload.otp));
}

export async function verifyCourierCustomerOtp(userId, assignmentId, payload = {}) {
  appCache.clearByPrefix("courier:dashboard:");
  appCache.clearByPrefix("customer:tracking:");
  appCache.del("admin:dashboard");
  return formatCourierAssignment(await verifyCourierDropoffOtp(userId, assignmentId, payload.otp));
}
