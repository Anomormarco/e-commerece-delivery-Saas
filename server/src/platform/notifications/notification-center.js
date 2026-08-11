import { prisma } from "../../database/prisma.js";

const labelsByEvent = {
  "admin.registered": ["Шинэ админ бүртгэл", "Админ хэрэглэгч бүртгэгдлээ."],
  "admin.profile.updated": ["Админ профайл шинэчлэгдлээ", "Профайлын мэдээлэл өөрчлөгдлөө."],
  "courier.registered": ["Шинэ хүргэлтийн ажилтан", "Employee verification амжилттай бүртгэгдлээ."],
  "courier.status.updated": ["Employee төлөв шинэчлэгдлээ", "Хүргэлтийн ажилтны online/offline төлөв өөрчлөгдлөө."],
  "delivery.request.created": ["Шинэ хүргэлтийн хүсэлт", "Store шинэ хүргэлтийн хүсэлт үүсгэлээ."],
  "delivery.job.accepted": ["Хүргэлт хүлээн авлаа", "Employee хүргэлтийн ажлыг хүлээн авлаа."],
  "delivery.job.rejected": ["Хүргэлт татгалзлаа", "Employee хүргэлтийн хүсэлтээс татгалзлаа."],
  "delivery.job.arrived_store": ["Employee дэлгүүр дээр ирлээ", "Pickup verification эхлэхэд бэлэн боллоо."],
  "delivery.job.pickup_verified": ["Pickup баталгаажлаа", "Store OTP баталгаажиж ачаа авлаа."],
  "delivery.job.dropoff_verified": ["Хүргэлт дууслаа", "Customer OTP баталгаажиж хүргэлт амжилттай дууслаа."],
};

function notificationCopy(event) {
  if (event.type === "order.paid") {
    const storeName = event.payload?.storeName ? String(event.payload.storeName) : "Дэлгүүр";
    const customerName = event.payload?.customerName ? String(event.payload.customerName) : "Хэрэглэгч";
    const totalMnt = Number(event.payload?.totalMnt ?? event.payload?.amountMnt ?? 0).toLocaleString("mn-MN");
    const orderNo = event.payload?.orderNo ?? event.payload?.orderId;
    const orderSuffix = orderNo ? ` #${String(orderNo).slice(-6)}` : "";

    return {
      title: `${storeName}: шинэ захиалга ирлээ`,
      body: `${customerName}${orderSuffix} захиалга sandbox/QPay төлбөрөөр баталгаажлаа. Нийт дүн: ${totalMnt} MNT.`,
    };
  }

  const [title, body] = labelsByEvent[event.type] ?? ["Системийн мэдэгдэл", `${event.type} event ирлээ.`];
  return { title, body };
}

function audienceForRole(role) {
  if (role === "admin") return { channel: "ADMIN", tenantId: null };
  if (role === "store") return { channel: "STORE", tenantId: null };
  if (role === "courier") return { channel: "EMPLOYEE", tenantId: null };
  return { channel: "CUSTOMER", tenantId: null };
}

export async function createNotificationFromEvent(role, event = {}) {
  const { channel, tenantId } = audienceForRole(role);
  const { title, body } = notificationCopy(event);
  const scopedUserId = role === "store" && event.payload?.storeId
    ? String(event.payload.storeId)
    : event.payload?.userId
      ? String(event.payload.userId)
      : null;

  return prisma.notification.create({
    data: {
      tenantId,
      userId: scopedUserId,
      title,
      body,
      channel,
      status: "SENT",
    },
  });
}

export async function listNotificationsForRole(role, { limit = 20 } = {}) {
  const { channel } = audienceForRole(role);
  const notifications = await prisma.notification.findMany({
    where: { channel },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    items: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      channel: notification.channel,
      status: notification.status,
      storeId: notification.channel === "STORE" ? notification.userId : undefined,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsReadForRole(role) {
  const { channel } = audienceForRole(role);
  await prisma.notification.updateMany({
    where: { channel, readAt: null },
    data: { status: "READ", readAt: new Date() },
  });

  return listNotificationsForRole(role);
}
