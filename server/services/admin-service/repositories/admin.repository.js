import { prisma } from "@deliverhub/server-platform/database/prisma";
import { hashPassword, normalizeGmailAddress, normalizePhone } from "@deliverhub/server-platform/auth/credentials";

const employeeRoleCodes = ["PLATFORM_ADMIN", "SHOP_ADMIN", "STORE_ADMIN", "DELIVERY_EMPLOYEE"];
const storePlanCode = "store-monthly-50000";
const storePlanAmountMnt = 50_000;

function httpError(statusCode, message, code = "VALIDATION_ERROR") {
  return Object.assign(new Error(message), { statusCode, code });
}

function slugify(value) {
  return (
    String(value ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "store"
  );
}

export async function getAdminDashboardStats() {
  const [activeDeliveries, pendingPickups, tenants, creditedLedger] = await Promise.all([
    prisma.deliveryAssignment.count({
      where: { status: { in: ["ACCEPTED", "PICKUP_VERIFICATION", "PICKED_UP", "IN_TRANSIT"] } },
    }),
    prisma.deliveryAssignment.count({
      where: { status: { in: ["OFFERED", "ARRIVING_PICKUP"] } },
    }),
    prisma.tenant.count(),
    prisma.ledgerEntry.aggregate({
      where: { type: "CREDIT" },
      _sum: { amountMnt: true },
    }),
  ]);

  return {
    activeDeliveries,
    pendingPickups,
    tenants,
    creditedRevenueMnt: creditedLedger._sum.amountMnt ?? 0n,
  };
}

export async function listRecentDeliveryAssignments({ limit = 8 } = {}) {
  return prisma.deliveryAssignment.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      order: {
        select: {
          store: { select: { name: true } },
        },
      },
    },
  });
}

export async function listPlatformStores({ limit = 200 } = {}) {
  return prisma.store.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          status: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              status: true,
              startsAt: true,
              endsAt: true,
              plan: { select: { name: true, monthlyPriceMnt: true } },
            },
          },
        },
      },
      branches: { take: 1, select: { address: true } },
      _count: { select: { products: true, orders: true } },
    },
  });
}

export async function listPlatformEmployees({ limit = 300 } = {}) {
  return prisma.user.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    where: {
      userRoles: {
        some: { role: { code: { in: employeeRoleCodes } } },
      },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      status: true,
      createdAt: true,
      userRoles: {
        select: { role: { select: { code: true, name: true } } },
      },
      tenantMemberships: {
        select: { role: true, tenant: { select: { name: true } } },
      },
      deliveryEmployee: {
        select: {
          vehicleType: true,
          vehiclePlate: true,
          online: true,
          rating: true,
          verificationStatus: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------- stores CRUD

async function ensureStorePlan(tx = prisma) {
  const existing = await tx.subscriptionPlan.findUnique({ where: { code: storePlanCode } });
  if (existing) return existing;
  return tx.subscriptionPlan.create({
    data: {
      code: storePlanCode,
      name: "Store monthly",
      monthlyPriceMnt: BigInt(storePlanAmountMnt),
      maxStoreUsers: 5,
      maxCouriers: 10,
      maxMonthlyOrders: 500,
      features: { dashboard: true, orders: true, products: true, delivery: true },
    },
  });
}

export async function createPlatformStore(payload = {}) {
  const name = String(payload.name ?? "").trim();
  if (!name) throw httpError(400, "Дэлгүүрийн нэрээ оруулна уу.");
  const description = String(payload.description ?? "").trim() || null;
  const months = Math.min(60, Math.max(0, Number(payload.subscriptionMonths ?? 6) || 0));

  const ownerName = String(payload.ownerName ?? "").trim();
  const ownerLoginRaw = String(payload.ownerEmail ?? payload.ownerPhone ?? "").trim();
  const ownerPassword = String(payload.ownerPassword ?? "");
  const wantsOwner = Boolean(ownerName && ownerLoginRaw && ownerPassword);

  const suffix = Date.now().toString(36);
  const slug = `${slugify(name)}-${suffix}`;

  return prisma.$transaction(async (tx) => {
    const plan = months > 0 ? await ensureStorePlan(tx) : null;

    const tenant = await tx.tenant.create({
      data: { name, slug, status: months > 0 ? "ACTIVE" : "TRIALING" },
    });
    const store = await tx.store.create({
      data: { tenantId: tenant.id, name, slug, description },
      select: { id: true, name: true },
    });

    if (plan) {
      const now = new Date();
      const endsAt = new Date(now);
      endsAt.setMonth(endsAt.getMonth() + months);
      await tx.subscription.create({
        data: { tenantId: tenant.id, planId: plan.id, status: "ACTIVE", startsAt: now, endsAt },
      });
    }

    if (wantsOwner) {
      const isEmail = ownerLoginRaw.includes("@");
      const login = isEmail ? normalizeGmailAddress(ownerLoginRaw) : normalizePhone(ownerLoginRaw);
      const clash = await tx.user.findFirst({
        where: isEmail ? { email: login } : { phone: login },
        select: { id: true },
      });
      if (clash) throw httpError(409, "Энэ нэвтрэх ID бүртгэлтэй байна.", "CONFLICT");
      const role = await tx.role.upsert({
        where: { code: "STORE_ADMIN" },
        update: {},
        create: { code: "STORE_ADMIN", name: "Store admin" },
      });
      const user = await tx.user.create({
        data: {
          fullName: ownerName,
          email: isEmail ? login : null,
          phone: isEmail ? normalizePhone(payload.ownerPhone ?? "") || null : login,
          passwordHash: hashPassword(ownerPassword),
          tenantMemberships: { create: { tenantId: tenant.id, role: "STORE_ADMIN", isOwner: true } },
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } });
    }

    return { id: store.id, name: store.name, tenantId: tenant.id };
  });
}

export async function updatePlatformStore(storeId, { name, description, isActive }) {
  return prisma.store.update({
    where: { id: storeId },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() || null } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
    },
    select: { id: true },
  });
}

export async function deactivatePlatformStore(storeId) {
  return prisma.store.update({
    where: { id: storeId },
    data: { isActive: false },
    select: { id: true },
  });
}

export async function deletePlatformStore(storeId) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  if (!store) throw httpError(404, "Дэлгүүр олдсонгүй.", "NOT_FOUND");
  // Cascades wipe stores/branches/products/subscriptions for the tenant.
  await prisma.tenant.delete({ where: { id: store.tenantId } });
  return { id: storeId };
}

export async function activateAllStoreSubscriptions({ days, months } = {}) {
  const now = new Date();
  let endsAt;
  let label;
  if (Number(days) > 0) {
    const step = Math.min(3650, Math.max(1, Number(days)));
    endsAt = new Date(now.getTime() + step * 24 * 60 * 60 * 1000);
    label = `${step} days`;
  } else {
    const step = Math.min(120, Math.max(1, Number(months) || 6));
    endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + step);
    label = `${step} months`;
  }

  const tenants = await prisma.tenant.findMany({
    where: { stores: { some: {} } },
    select: { id: true },
  });

  let activated = 0;
  await prisma.$transaction(async (tx) => {
    const plan = await ensureStorePlan(tx);
    for (const tenant of tenants) {
      await tx.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
      await tx.subscription.deleteMany({ where: { tenantId: tenant.id } });
      await tx.subscription.create({
        data: { tenantId: tenant.id, planId: plan.id, status: "ACTIVE", startsAt: now, endsAt },
      });
      activated += 1;
    }
  });

  return { activated, endsAt: endsAt.toISOString(), duration: label };
}

export async function extendPlatformStoreSubscription(storeId, months = 1) {
  const step = Math.min(60, Math.max(1, Number(months) || 1));
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { tenantId: true } });
  if (!store) throw httpError(404, "Дэлгүүр олдсонгүй.", "NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const plan = await ensureStorePlan(tx);
    const current = await tx.subscription.findFirst({
      where: { tenantId: store.tenantId },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const base = current?.endsAt && current.endsAt > now ? new Date(current.endsAt) : now;
    const endsAt = new Date(base);
    endsAt.setMonth(endsAt.getMonth() + step);

    await tx.tenant.update({ where: { id: store.tenantId }, data: { status: "ACTIVE" } });
    await tx.subscription.create({
      data: { tenantId: store.tenantId, planId: plan.id, status: "ACTIVE", startsAt: now, endsAt },
    });
    return { storeId, endsAt: endsAt.toISOString() };
  });
}

// ------------------------------------------------------------- employees CRUD

export async function createPlatformEmployee(payload = {}) {
  const fullName = String(payload.fullName ?? "").trim();
  if (!fullName) throw httpError(400, "Ажилтны нэрээ оруулна уу.");
  const roleCode = employeeRoleCodes.includes(payload.roleCode) ? payload.roleCode : "DELIVERY_EMPLOYEE";
  const password = String(payload.password ?? "");
  if (password.length < 8) throw httpError(400, "Нууц үг 8+ тэмдэгттэй байх ёстой.");

  const emailRaw = String(payload.email ?? "").trim();
  const phoneRaw = String(payload.phone ?? "").trim();
  const email = emailRaw ? normalizeGmailAddress(emailRaw) : null;
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!email && !phone) throw httpError(400, "Имэйл эсвэл утасны дугаар оруулна уу.");

  return prisma.$transaction(async (tx) => {
    const clash = await tx.user.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      select: { id: true },
    });
    if (clash) throw httpError(409, "Энэ хэрэглэгч бүртгэлтэй байна.", "CONFLICT");

    const role = await tx.role.upsert({
      where: { code: roleCode },
      update: {},
      create: { code: roleCode, name: roleCode },
    });
    const user = await tx.user.create({
      data: { fullName, email, phone, passwordHash: hashPassword(password), status: "ACTIVE" },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

    if (roleCode === "DELIVERY_EMPLOYEE") {
      const tenant = await tx.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      if (tenant) {
        await tx.deliveryEmployee.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            vehicleType: String(payload.vehicleType ?? "WALK"),
            vehiclePlate: String(payload.vehiclePlate ?? "").trim() || null,
          },
        });
      }
    }

    return { id: user.id, fullName: user.fullName };
  });
}

export async function updatePlatformEmployee(userId, payload = {}) {
  const { fullName, status, phone, email, vehicleType, vehiclePlate } = payload;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
      ...(status ? { status } : {}),
      ...(phone !== undefined ? { phone: String(phone).trim() ? normalizePhone(phone) : null } : {}),
      ...(email !== undefined ? { email: String(email).trim() ? normalizeGmailAddress(email) : null } : {}),
    },
    select: { id: true },
  });

  if (vehicleType !== undefined || vehiclePlate !== undefined) {
    await prisma.deliveryEmployee
      .update({
        where: { userId },
        data: {
          ...(vehicleType !== undefined ? { vehicleType: String(vehicleType) } : {}),
          ...(vehiclePlate !== undefined ? { vehiclePlate: String(vehiclePlate).trim() || null } : {}),
        },
      })
      .catch(() => null);
  }

  return { id: userId };
}

export async function deactivatePlatformEmployee(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED" },
    select: { id: true },
  });
}

export async function deletePlatformEmployee(userId) {
  await prisma.user.delete({ where: { id: userId } });
  return { id: userId };
}
