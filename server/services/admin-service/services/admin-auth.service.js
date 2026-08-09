import { createHash, randomBytes } from "node:crypto";
import { ActorRole } from "@prisma/client";
import {
  hashPassword,
  validateGmailAddress,
  validateStrongPassword,
  verifyPassword,
} from "@deliverhub/server-platform/auth/credentials";
import { prisma } from "@deliverhub/server-platform/database/prisma";

const sessionCookieName = "deliverhub_admin_session";
const sessionMaxAgeMs = 1000 * 60 * 60 * 12;

function createHttpError(statusCode, message, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request, name) {
  const cookieHeader = request.header("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function setSessionCookie(response, token) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeMs,
    sameSite: "lax",
    secure: false,
  });
}

function clearSessionCookie(response) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });
}

function publicAdminUser(user) {
  return {
    id: user.id,
    username: user.email,
    fullName: user.fullName,
    role: ActorRole.PLATFORM_ADMIN,
  };
}

async function findPlatformAdminRole() {
  return prisma.role.upsert({
    where: { code: ActorRole.PLATFORM_ADMIN },
    update: {},
    create: {
      code: ActorRole.PLATFORM_ADMIN,
      name: "Платформ админ",
    },
  });
}

async function countPlatformAdmins() {
  return prisma.userRole.count({
    where: {
      role: {
        code: ActorRole.PLATFORM_ADMIN,
      },
    },
  });
}

async function createAdminSession(user, request, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshHash: hashToken(token),
      ipAddress: request.ip,
      userAgent: request.header("user-agent"),
      expiresAt,
    },
  });

  setSessionCookie(response, token);
  return publicAdminUser(user);
}

export async function registerFirstPlatformAdmin({ fullName, username, password }) {
  if (!fullName?.trim() || !username?.trim() || !password) {
    throw createHttpError(400, "Нэр, Gmail хаяг, нууц үгээ оруулна уу.");
  }

  const email = validateGmailAddress(username);
  validateStrongPassword(password);

  if ((await countPlatformAdmins()) > 0) {
    throw createHttpError(409, "Админ бүртгэл аль хэдийн үүссэн байна. Нэвтэрнэ үү.", "CONFLICT");
  }

  const role = await findPlatformAdminRole();
  const user = await prisma.user.create({
    data: {
      email,
      fullName: fullName.trim(),
      passwordHash: hashPassword(password),
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
    },
  });

  return publicAdminUser(user);
}

export async function loginPlatformAdmin({ username, password }, request, response) {
  if (!username?.trim() || !password) {
    throw createHttpError(400, "Gmail хаяг болон нууц үгээ оруулна уу.");
  }

  const email = validateGmailAddress(username);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  const isPlatformAdmin = user?.userRoles.some((userRole) => userRole.role.code === ActorRole.PLATFORM_ADMIN);
  const passwordMatches = user?.passwordHash ? verifyPassword(password, user.passwordHash) : false;

  if (!user || !isPlatformAdmin || !passwordMatches) {
    throw createHttpError(401, "Gmail хаяг эсвэл нууц үг буруу байна.", "UNAUTHENTICATED");
  }

  return createAdminSession(user, request, response);
}

export async function getPlatformAdminFromRequest(request) {
  const token = readCookie(request, sessionCookieName);

  if (!token) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      refreshHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: {
        status: "ACTIVE",
        userRoles: {
          some: {
            role: {
              code: ActorRole.PLATFORM_ADMIN,
            },
          },
        },
      },
    },
    include: { user: true },
  });

  return session ? publicAdminUser(session.user) : null;
}

export async function logoutPlatformAdmin(request, response) {
  const token = readCookie(request, sessionCookieName);

  if (token) {
    await prisma.session.updateMany({
      where: { refreshHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearSessionCookie(response);
}

export async function updatePlatformAdminProfile(request, { fullName, username }) {
  const currentUser = await getPlatformAdminFromRequest(request);

  if (!currentUser) {
    throw createHttpError(401, "Админ эрхээр нэвтрэх шаардлагатай.", "UNAUTHENTICATED");
  }

  if (!fullName?.trim() || !username?.trim()) {
    throw createHttpError(400, "Нэр болон Gmail хаяг заавал орно.");
  }

  const nextUsername = validateGmailAddress(username);
  const existingUser = await prisma.user.findFirst({
    where: {
      email: nextUsername,
      NOT: { id: currentUser.id },
    },
  });

  if (existingUser) {
    throw createHttpError(409, "Энэ Gmail хаяг бүртгэлтэй байна.", "CONFLICT");
  }

  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      email: nextUsername,
      fullName: fullName.trim(),
    },
  });

  return publicAdminUser(user);
}

export function requirePlatformAdmin(handler) {
  return async (request, response) => {
    const user = await getPlatformAdminFromRequest(request);

    if (!user) {
      response.status(401).json({
        status: "error",
        statusCode: 401,
        message: "Админ эрхээр нэвтрэх шаардлагатай.",
        code: "UNAUTHENTICATED",
        service: "admin-service",
      });
      return;
    }

    request.adminUser = user;
    await handler(request, response);
  };
}
