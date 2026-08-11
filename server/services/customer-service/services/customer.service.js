import { ActorRole, OrderStatus, PaymentStatus } from "@prisma/client";
import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import {
  hashPassword,
  normalizePhone,
  validateGmailAddress,
  validateStrongPassword,
  verifyPassword,
} from "@deliverhub/server-platform/auth/credentials";
import { prisma } from "@deliverhub/server-platform/database/prisma";
import { signJwt } from "@deliverhub/server-platform/http/jwt";
import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { customerEventBus } from "../messaging.js";
import { findCustomerOrderHistory, findCustomerWithLatestOrder } from "../repositories/customer.repository.js";
import { formatTrackingTime, maskPhone } from "../utils/customer-formatting.js";

const demoTenantSlug = "deliverhub-public";
const demoStoreSlug = "nomincart-public";
const customerJwtExpiresInSeconds = 60 * 60 * 24 * 7;

const deliveryRates = {
  foot: { label: "Явган хүргэлт", base: 1800, perKm: 700, perKg: 180, speedKmh: 4 },
  bike: { label: "Мопед/дугуй", base: 2500, perKm: 900, perKg: 140, speedKmh: 18 },
  car: { label: "Машин", base: 4200, perKm: 1200, perKg: 110, speedKmh: 28 },
};

function createHttpError(statusCode, message, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function money(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function publicCustomer(customer) {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
  };
}

function customerToken(user, customer, tenantId) {
  return signJwt(
    {
      sub: user.id,
      customerId: customer.id,
      tenantId,
      roles: [ActorRole.CUSTOMER],
    },
    { expiresInSeconds: customerJwtExpiresInSeconds },
  );
}

function distanceKm(from, to) {
  const lat1 = Number(from.latitude);
  const lon1 = Number(from.longitude);
  const lat2 = Number(to.latitude);
  const lon2 = Number(to.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 5.2;

  const earthRadiusKm = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;

  return Math.max(0.8, Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10);
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function customerCourierLocation(order, assignment) {
  const pickup = {
    latitude: toNumber(order.branch?.latitude, 47.9186),
    longitude: toNumber(order.branch?.longitude, 106.9176),
  };
  const dropoff = {
    latitude: toNumber(order.customerAddress?.latitude, pickup.latitude + 0.035),
    longitude: toNumber(order.customerAddress?.longitude, pickup.longitude + 0.052),
  };
  const status = assignment?.status;

  if (["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF", "DELIVERED"].includes(status)) {
    const progress = status === "DELIVERED" ? 1 : 0.58 + Math.sin(Date.now() / 22000) * 0.18;
    return {
      latitude: pickup.latitude + (dropoff.latitude - pickup.latitude) * progress,
      longitude: pickup.longitude + (dropoff.longitude - pickup.longitude) * progress,
      updatedAt: new Date().toISOString(),
    };
  }

  const approach = status === "PICKUP_VERIFICATION" ? 1 : status === "ACCEPTED" ? 0.72 : 0.35;
  return {
    latitude: pickup.latitude - 0.018 + 0.018 * approach,
    longitude: pickup.longitude - 0.024 + 0.024 * approach,
    updatedAt: new Date().toISOString(),
  };
}

function publicOrderStatusLabel(order, assignment) {
  if (assignment?.status === "DELIVERED" || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) return "Хүргэлт дууссан";
  if (["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF"].includes(assignment?.status) || [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVING].includes(order.status)) return "Хүргэлтэнд гарсан";
  if (assignment?.status === "PICKUP_VERIFICATION" || order.status === OrderStatus.PICKUP_VERIFICATION) return "Дэлгүүр дээр OTP баталгаажуулж байна";
  if (assignment?.status === "ACCEPTED" || order.status === OrderStatus.COURIER_ARRIVING) return "Хүргэлтийн ажилтан дэлгүүр рүү ирж байна";
  if (order.status === OrderStatus.READY_FOR_PICKUP || order.status === OrderStatus.COURIER_ASSIGNED) return "Захиалга бэлтгэгдсэн";
  if (order.status === OrderStatus.PREPARING) return "Захиалга бэлтгэж байна";
  return "Захиалга баталгаажсан";
}

function publicTimelineState(order, assignment, stepStatus) {
  const orderStatus = order.status;
  const assignmentStatus = assignment?.status;
  const reached = {
    confirmed: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP, OrderStatus.COURIER_ASSIGNED, OrderStatus.COURIER_ARRIVING, OrderStatus.PICKUP_VERIFICATION, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVING, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(orderStatus),
    prepared: [OrderStatus.READY_FOR_PICKUP, OrderStatus.COURIER_ASSIGNED, OrderStatus.COURIER_ARRIVING, OrderStatus.PICKUP_VERIFICATION, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVING, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(orderStatus),
    pickedUp: ["PICKED_UP", "IN_TRANSIT", "ARRIVING_DROPOFF", "DELIVERED"].includes(assignmentStatus) || [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVING, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(orderStatus),
    delivered: assignmentStatus === "DELIVERED" || [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(orderStatus),
  };
  const orderKeys = ["confirmed", "prepared", "pickedUp", "delivered"];
  const currentIndex = Math.max(0, orderKeys.findIndex((key) => !reached[key]));
  const stepIndex = orderKeys.indexOf(stepStatus);

  if (reached[stepStatus]) return "done";
  return stepIndex === currentIndex ? "active" : "pending";
}

function quoteDelivery({ distanceKmValue, weightKg, deliveryType }) {
  const rate = deliveryRates[deliveryType] ?? deliveryRates.bike;
  const feeMnt = money(rate.base + distanceKmValue * rate.perKm + weightKg * rate.perKg);
  const etaMinutes = Math.max(12, Math.round((distanceKmValue / rate.speedKmh) * 60 + 10));

  return {
    deliveryType,
    deliveryTypeLabel: rate.label,
    distanceKm: distanceKmValue,
    weightKg,
    deliveryFeeMnt: feeMnt,
    etaMinutes,
  };
}

async function ensureCustomerRole() {
  return prisma.role.upsert({
    where: { code: ActorRole.CUSTOMER },
    update: {},
    create: {
      code: ActorRole.CUSTOMER,
      name: "Хэрэглэгч",
    },
  });
}

async function ensureDemoTenant() {
  return prisma.tenant.upsert({
    where: { slug: demoTenantSlug },
    update: {},
    create: {
      name: "DeliverHub Public",
      slug: demoTenantSlug,
    },
  });
}

async function ensureDemoStore() {
  const tenant = await ensureDemoTenant();

  const store = await prisma.store.upsert({
    where: { slug: demoStoreSlug },
    update: {
      name: "Номин Маркет",
      description: "Landing page маркетийн demo catalog",
    },
    create: {
      tenantId: tenant.id,
      name: "Номин Маркет",
      slug: demoStoreSlug,
      description: "Landing page маркетийн demo catalog",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: `${store.id}-main-branch` },
    update: {
      name: "Төв салбар",
      address: "Улаанбаатар, Сүхбаатар дүүрэг",
      latitude: 47.9186,
      longitude: 106.9176,
    },
    create: {
      id: `${store.id}-main-branch`,
      tenantId: tenant.id,
      storeId: store.id,
      name: "Төв салбар",
      address: "Улаанбаатар, Сүхбаатар дүүрэг",
      latitude: 47.9186,
      longitude: 106.9176,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { id: `${branch.id}-warehouse` },
    update: {
      name: "Үндсэн агуулах",
    },
    create: {
      id: `${branch.id}-warehouse`,
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Үндсэн агуулах",
    },
  });

  return { tenant, store, branch, warehouse };
}

async function ensureVariant(tx, { tenantId, storeId, warehouseId, item }) {
  const sku = String(item.sku ?? item.id ?? item.name).slice(0, 32);
  const slug = String(item.category ?? "public").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "public";
  const category = await tx.category.upsert({
    where: {
      tenantId_slug: {
        tenantId,
        slug,
      },
    },
    update: {},
    create: {
      tenantId,
      name: String(item.category ?? "Бараа"),
      slug,
    },
  });

  const product = await tx.product.upsert({
    where: { id: `${storeId}-${sku}-product` },
    update: {
      name: String(item.name),
      description: String(item.description ?? ""),
      categoryId: category.id,
    },
    create: {
      id: `${storeId}-${sku}-product`,
      tenantId,
      storeId,
      categoryId: category.id,
      name: String(item.name),
      description: String(item.description ?? ""),
    },
  });

  const variant = await tx.productVariant.upsert({
    where: {
      productId_sku: {
        productId: product.id,
        sku,
      },
    },
    update: {
      name: String(item.name),
      priceMnt: BigInt(money(item.priceMnt)),
      weightGrams: money(item.weightGrams ?? 500),
    },
    create: {
      productId: product.id,
      sku,
      name: String(item.name),
      priceMnt: BigInt(money(item.priceMnt)),
      weightGrams: money(item.weightGrams ?? 500),
    },
  });

  await tx.inventoryItem.upsert({
    where: {
      warehouseId_variantId: {
        warehouseId,
        variantId: variant.id,
      },
    },
    update: {},
    create: {
      warehouseId,
      variantId: variant.id,
      quantity: 100,
    },
  });

  return variant;
}

export async function registerCustomer({ fullName, email, phone, password }) {
  if (!fullName?.trim() || !phone?.trim() || !password) {
    throw createHttpError(400, "Нэр, утас, нууц үгээ бүрэн оруулна уу.");
  }

  const normalizedEmail = email?.trim() ? validateGmailAddress(email) : null;
  const normalizedPhone = normalizePhone(phone);
  validateStrongPassword(password);

  const tenant = await ensureDemoTenant();
  const role = await ensureCustomerRole();

  const existingUser = normalizedEmail
    ? await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { phone: normalizedPhone }] } })
    : await prisma.user.findUnique({ where: { phone: normalizedPhone } });

  if (existingUser) {
    throw createHttpError(409, "Энэ хэрэглэгч аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.", "CONFLICT");
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      phone: normalizedPhone,
      fullName: fullName.trim(),
      passwordHash: hashPassword(password),
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
      customer: {
        create: {
          tenantId: tenant.id,
          fullName: fullName.trim(),
          phone: normalizedPhone,
          email: normalizedEmail,
        },
      },
    },
    include: { customer: true },
  });

  return {
    token: customerToken(user, user.customer, tenant.id),
    customer: publicCustomer(user.customer),
  };
}

export async function loginCustomer({ login, password }) {
  if (!login?.trim() || !password) {
    throw createHttpError(400, "Нэвтрэх нэр болон нууц үгээ оруулна уу.");
  }

  const loginValue = String(login).trim();
  const where = loginValue.includes("@")
    ? { email: validateGmailAddress(loginValue) }
    : { phone: normalizePhone(loginValue) };

  const user = await prisma.user.findUnique({
    where,
    include: {
      customer: true,
      userRoles: { include: { role: true } },
    },
  });

  const isCustomer = user?.userRoles.some((userRole) => userRole.role.code === ActorRole.CUSTOMER);
  if (!user || !user.customer || !isCustomer || !verifyPassword(password, user.passwordHash)) {
    throw createHttpError(401, "Нэвтрэх мэдээлэл буруу байна.", "UNAUTHENTICATED");
  }

  return {
    token: customerToken(user, user.customer, user.customer.tenantId),
    customer: publicCustomer(user.customer),
  };
}

export async function createCustomerOrder(userId, input) {
  if (!userId) {
    throw createHttpError(401, "Захиалга хийхийн тулд нэвтэрнэ үү.", "UNAUTHENTICATED");
  }

  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) throw createHttpError(404, "Хэрэглэгч олдсонгүй.", "NOT_FOUND");

  const items = Array.isArray(input.items) ? input.items.filter((item) => Number(item.quantity) > 0) : [];
  if (!items.length) throw createHttpError(400, "Захиалах бараагаа сонгоно уу.");
  if (!input.addressText?.trim()) throw createHttpError(400, "Хаягаа текстээр баталгаажуулна уу.");

  const { tenant, store, branch, warehouse } = await ensureDemoStore();
  const dropoff = {
    latitude: Number(input.location?.latitude ?? branch.latitude),
    longitude: Number(input.location?.longitude ?? branch.longitude),
  };
  const pickup = { latitude: Number(branch.latitude), longitude: Number(branch.longitude) };
  const distanceKmValue = distanceKm(pickup, dropoff);
  const subtotalMnt = items.reduce((sum, item) => sum + money(item.priceMnt) * money(item.quantity), 0);
  const weightKg = Math.round(items.reduce((sum, item) => sum + money(item.weightGrams ?? 500) * money(item.quantity), 0) / 100) / 10;
  const quote = quoteDelivery({ distanceKmValue, weightKg, deliveryType: input.deliveryType });
  const serviceFeeMnt = 500;
  const totalMnt = subtotalMnt + quote.deliveryFeeMnt + serviceFeeMnt;

  const order = await prisma.$transaction(async (tx) => {
    const address = await tx.customerAddress.create({
      data: {
        customerId: customer.id,
        label: String(input.addressLabel ?? "Одоогийн байршил"),
        address: input.addressText.trim(),
        latitude: Number.isFinite(dropoff.latitude) ? dropoff.latitude : null,
        longitude: Number.isFinite(dropoff.longitude) ? dropoff.longitude : null,
        isDefault: true,
      },
    });

    const createdOrder = await tx.order.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        branchId: branch.id,
        customerId: customer.id,
        customerAddressId: address.id,
        status: OrderStatus.PAID,
        subtotalMnt: BigInt(subtotalMnt),
        deliveryFeeMnt: BigInt(quote.deliveryFeeMnt),
        serviceFeeMnt: BigInt(serviceFeeMnt),
        totalMnt: BigInt(totalMnt),
      },
    });

    for (const item of items) {
      const variant = await ensureVariant(tx, { tenantId: tenant.id, storeId: store.id, warehouseId: warehouse.id, item });
      await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          variantId: variant.id,
          productName: String(item.name),
          quantity: money(item.quantity),
          unitPriceMnt: BigInt(money(item.priceMnt)),
          totalMnt: BigInt(money(item.priceMnt) * money(item.quantity)),
        },
      });
    }

    await tx.orderStatusHistory.createMany({
      data: [
        { orderId: createdOrder.id, status: OrderStatus.PAID, note: "Төлбөр төлөгдсөн" },
      ],
    });

    await tx.paymentInvoice.create({
      data: {
        tenantId: tenant.id,
        orderId: createdOrder.id,
        provider: "local-demo",
        providerInvoiceId: `local-${createdOrder.id}`,
        amountMnt: BigInt(totalMnt),
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        callbackPayload: {
          deliveryType: quote.deliveryType,
          deliveryTypeLabel: quote.deliveryTypeLabel,
          distanceKm: quote.distanceKm,
          weightKg: quote.weightKg,
        },
      },
    });

    return createdOrder;
  });

  appCache.forget?.(`customer:tracking:${userId}`);
  const paidEventPayload = {
    orderId: order.id,
    storeId: store.id,
    storeName: store.name,
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.phone,
    addressText: input.addressText.trim(),
    addressLabel: String(input.addressLabel ?? "Одоогийн байршил"),
    paymentMethod: String(input.paymentMethod ?? "QPay"),
    amountMnt: String(totalMnt),
    subtotalMnt: String(subtotalMnt),
    deliveryFeeMnt: String(quote.deliveryFeeMnt),
    deliveryType: quote.deliveryType,
    deliveryTypeLabel: quote.deliveryTypeLabel,
    items: items.map((item) => ({
      name: String(item.name),
      quantity: money(item.quantity),
      amountMnt: String(money(item.priceMnt) * money(item.quantity)),
    })),
  };

  customerEventBus.publishSoon("order.paid", paidEventPayload);
  createNotificationFromEvent("store", {
    type: "order.paid",
    payload: paidEventPayload,
  }).catch((error) => {
    console.warn("[customer-service] store notification create failed", error.message);
  });

  return {
    success: true,
    message: "Хүсэлт амжилттай. Төлбөр баталгаажиж хүргэлтэд шилжлээ.",
    orderNo: order.id,
    quote,
    subtotalMnt,
    serviceFeeMnt,
    totalMnt,
  };
}

export async function listCustomerStores(userId, input = {}) {
  if (!userId) {
    throw createHttpError(401, "Маркет харахын тулд эхлээд нэвтэрнэ үү.", "UNAUTHENTICATED");
  }

  await ensureDemoStore();

  const search = String(input.search ?? "").trim();
  const page = Math.max(1, Number.parseInt(String(input.page ?? "1"), 10) || 1);
  const pageSize = Math.min(50, Math.max(4, Number.parseInt(String(input.pageSize ?? "50"), 10) || 50));
  const where = {
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { branches: { some: { address: { contains: search, mode: "insensitive" } } } },
            { products: { some: { name: { contains: search, mode: "insensitive" } } } },
            { products: { some: { category: { name: { contains: search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const [total, stores] = await Promise.all([
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        branches: { take: 1 },
        products: {
          where: { isActive: true },
          take: 50,
          include: {
            category: true,
            variants: { take: 1 },
            media: { take: 1, orderBy: { sortOrder: "asc" } },
          },
        },
        _count: {
          select: { products: true, orders: true },
        },
      },
    }),
  ]);

  const items = stores.map((store) => {
    const branch = store.branches[0];
    const categories = [...new Set(store.products.map((product) => product.category?.name).filter(Boolean))];
    return {
      id: store.id,
      name: store.name,
      description: store.description ?? "Хэрэглэгчдэд нээлттэй маркет",
      slug: store.slug,
      address: branch?.address ?? "Хаяг бүртгэгдээгүй",
      latitude: branch?.latitude ? Number(branch.latitude) : null,
      longitude: branch?.longitude ? Number(branch.longitude) : null,
      coverUrl: store.products[0]?.media[0]?.url ?? "",
      productCount: store._count.products,
      orderCount: store._count.orders,
      categories,
      products: store.products.map((product) => {
        const variant = product.variants[0];
        return {
          id: product.id,
          name: product.name,
          category: product.category?.name ?? "Бараа",
          priceMnt: variant?.priceMnt?.toString() ?? "0",
          weightGrams: variant?.weightGrams ?? 500,
          imageUrl: product.media[0]?.url ?? "",
        };
      }),
    };
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
export async function getCurrentCustomerTracking(userId) {
  return appCache.remember(`customer:tracking:${userId || "default"}`, () => loadCurrentCustomerTracking(userId), 8_000);
}

export async function listCustomerOrderHistory(userId, { limit = 10 } = {}) {
  const customer = await findCustomerOrderHistory(userId, { limit: Math.min(20, Math.max(1, Number(limit) || 10)) });

  return {
    items: (customer?.orders ?? []).map((order) => {
      const latestHistory = order.statusHistory[order.statusHistory.length - 1];

      return {
        orderNo: order.id,
        storeName: order.store.name,
        district: order.customerAddress?.address ?? "Хаяг сонгогдоогүй байна",
        statusLabel: order.status,
        totalMnt: order.totalMnt.toString(),
        createdAt: order.createdAt.toISOString(),
        updatedAt: latestHistory?.createdAt?.toISOString() ?? order.updatedAt.toISOString(),
        statusNote: latestHistory?.note ?? "Захиалгын явц шинэчлэгдэж байна",
        items: order.items.map((item) => ({
          label: `${item.productName} x${item.quantity}`,
          amountMnt: item.totalMnt.toString(),
        })),
      };
    }),
  };
}

async function loadCurrentCustomerTracking(userId) {
  const customer = await findCustomerWithLatestOrder(userId);
  const order = customer?.orders[0];
  if (!order) return null;

  const assignment = order.deliveryAssignments[0];
  const courier = assignment?.employee;
  const trackingSteps = [
    { key: "confirmed", historyStatuses: [OrderStatus.PAID, OrderStatus.CONFIRMED], title: "Захиалга баталгаажсан" },
    { key: "prepared", historyStatuses: [OrderStatus.READY_FOR_PICKUP, OrderStatus.COURIER_ASSIGNED], title: "Захиалга бэлтгэгдсэн" },
    { key: "pickedUp", historyStatuses: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT], title: "Хүргэлтэнд гарсан" },
    { key: "delivered", historyStatuses: [OrderStatus.DELIVERED, OrderStatus.COMPLETED], title: "Хүргэлт дууссан" },
  ];

  return {
    orderNo: order.id,
    storeName: order.store.name,
    district: order.customerAddress?.address ?? "Хаяг сонгогдоогүй байна",
    statusLabel: publicOrderStatusLabel(order, assignment),
    items: order.items.map((item) => ({
      label: `${item.productName} x${item.quantity}`,
      amountMnt: item.totalMnt.toString(),
    })),
    totalMnt: order.totalMnt.toString(),
    timeline: trackingSteps.map((step) => {
      const history = order.statusHistory.find((item) => step.historyStatuses.includes(item.status));
      const state = publicTimelineState(order, assignment, step.key);
      return {
        state,
        icon: state === "done" ? "ok" : "[]",
        title: step.title,
        description: history?.note ?? (state === "active" ? "Одоогийн төлөв" : "Хүлээгдэж байна"),
        time: history ? formatTrackingTime(history.createdAt) : "",
      };
    }),
    courier: {
      name: courier?.user.fullName ?? "Курьер оноогдоогүй",
      rating: courier?.rating?.toString() ?? "-",
      vehicle: courier?.vehicleType ?? "-",
      plate: courier?.vehiclePlate ?? "-",
      etaText: assignment ? "Realtime байршил идэвхтэй" : "Хүргэлтийн ажилтан хүлээгдэж байна",
    },
    courierLocation: assignment ? customerCourierLocation(order, assignment) : null,
    secretCode: [],
    maskedPhone: maskPhone(customer?.phone),
  };
}

